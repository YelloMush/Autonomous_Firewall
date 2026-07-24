import boto3

def open_ssh():
    ec2 = boto3.client('ec2', region_name='ap-south-1')
    
    print("[*] Looking up EC2 instance Security Group...")
    try:
        # Retrieve the running security group attached to our sensor
        response = ec2.describe_instances(Filters=[
            {'Name': 'key-name', 'Values': ['aegis_edge_key']},
            {'Name': 'instance-state-name', 'Values': ['running']}
        ])
        instance = response['Reservations'][0]['Instances'][0]
        sg_id = instance['SecurityGroups'][0]['GroupId']
        print(f"[*] Found Security Group: {sg_id}")
        
        # Authorize Port 22 (SSH)
        print("[*] Authorizing Port 22 for SSH access...")
        ec2.authorize_security_group_ingress(
            GroupId=sg_id,
            IpPermissions=[{
                'IpProtocol': 'tcp',
                'FromPort': 22,
                'ToPort': 22,
                'IpRanges': [{'CidrIp': '0.0.0.0/0'}]
            }]
        )
        print("[+] SUCCESS: SSH Port 22 is now open. You can connect to the instance.")
    except Exception as e:
        if "InvalidPermission.Duplicate" in str(e):
            print("[+] SSH Port 22 is already open.")
        else:
            print(f"[-] Error: {e}")

if __name__ == "__main__":
    open_ssh()
