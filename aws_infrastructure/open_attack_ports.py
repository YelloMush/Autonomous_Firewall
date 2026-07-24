import boto3

def open_attack_ports():
    ec2 = boto3.client('ec2', region_name='ap-south-1')
    
    print("[*] Looking up EC2 instance Security Group...")
    try:
        response = ec2.describe_instances(Filters=[
            {'Name': 'key-name', 'Values': ['aegis_edge_key']},
            {'Name': 'instance-state-name', 'Values': ['running']}
        ])
        instance = response['Reservations'][0]['Instances'][0]
        sg_id = instance['SecurityGroups'][0]['GroupId']
        print(f"[*] Found Security Group: {sg_id}")
        
        print("[*] Authorizing UDP Ports 10000-60000 for the Volumetric Attack...")
        ec2.authorize_security_group_ingress(
            GroupId=sg_id,
            IpPermissions=[{
                'IpProtocol': 'udp',
                'FromPort': 10000,
                'ToPort': 60000,
                'IpRanges': [{'CidrIp': '0.0.0.0/0'}]
            }]
        )
        print("[+] SUCCESS: The AWS firewall is now allowing the attack traffic through to the sensor!")
    except Exception as e:
        if "InvalidPermission.Duplicate" in str(e):
            print("[+] Ports are already open.")
        else:
            print(f"[-] Error: {e}")

if __name__ == "__main__":
    open_attack_ports()
