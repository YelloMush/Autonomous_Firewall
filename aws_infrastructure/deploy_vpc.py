import boto3

def provision_aegis_network():
    ec2 = boto3.client('ec2', region_name='ap-south-1')
    ec2_resource = boto3.resource('ec2', region_name='ap-south-1')

    try:
        print("[*] 1. Provisioning Aegis VPC...")
        vpc_response = ec2.create_vpc(CidrBlock='10.0.0.0/16')
        vpc_id = vpc_response['Vpc']['VpcId']
        
        # Tag the VPC for easy identification in the AWS Console
        ec2.create_tags(Resources=[vpc_id], Tags=[{'Key': 'Name', 'Value': 'Aegis-Core-VPC'}])
        
        # Enable DNS hostnames (required for Fargate and RDS later)
        ec2.modify_vpc_attribute(VpcId=vpc_id, EnableDnsHostnames={'Value': True})
        print(f"[+] VPC Created: {vpc_id}")

        print("[*] 2. Creating and Attaching Internet Gateway...")
        igw_response = ec2.create_internet_gateway()
        igw_id = igw_response['InternetGateway']['InternetGatewayId']
        ec2.attach_internet_gateway(InternetGatewayId=igw_id, VpcId=vpc_id)
        ec2.create_tags(Resources=[igw_id], Tags=[{'Key': 'Name', 'Value': 'Aegis-IGW'}])
        print(f"[+] IGW Attached: {igw_id}")

        print("[*] 3. Provisioning Public Subnet...")
        subnet_response = ec2.create_subnet(VpcId=vpc_id, CidrBlock='10.0.1.0/24', AvailabilityZone='ap-south-1a')
        subnet_id = subnet_response['Subnet']['SubnetId']
        
        # Ensure instances launched here get public IPs automatically
        ec2.modify_subnet_attribute(SubnetId=subnet_id, MapPublicIpOnLaunch={'Value': True})
        ec2.create_tags(Resources=[subnet_id], Tags=[{'Key': 'Name', 'Value': 'Aegis-Edge-Subnet'}])
        print(f"[+] Subnet Created: {subnet_id}")

        print("[*] 4. Configuring Route Table...")
        route_table_response = ec2.create_route_table(VpcId=vpc_id)
        rt_id = route_table_response['RouteTable']['RouteTableId']
        
        # Route all outbound traffic (0.0.0.0/0) to the Internet Gateway
        ec2.create_route(RouteTableId=rt_id, DestinationCidrBlock='0.0.0.0/0', GatewayId=igw_id)
        ec2.associate_route_table(RouteTableId=rt_id, SubnetId=subnet_id)
        ec2.create_tags(Resources=[rt_id], Tags=[{'Key': 'Name', 'Value': 'Aegis-Public-RT'}])
        print(f"[+] Route Table Configured: {rt_id}")

        print("\n========================================")
        print("✅ NETWORK INFRASTRUCTURE DEPLOYED SUCCESSFULLY")
        print("========================================")
        
        # Append these new IDs to your config file
        with open("aegis_config.txt", "a") as f:
            f.write(f"\nVPC_ID={vpc_id}")
            f.write(f"\nSUBNET_ID={subnet_id}\n")

    except Exception as e:
        print(f"\n[!] Deployment failed: {e}")

if __name__ == "__main__":
    provision_aegis_network()