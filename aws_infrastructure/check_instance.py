"""Quick check — shows all Aegis EC2 instances and their current state."""
import boto3

ec2 = boto3.client('ec2', region_name='ap-south-1')
resp = ec2.describe_instances(Filters=[
    {'Name': 'key-name', 'Values': ['aegis_edge_key']}
])

if not resp['Reservations']:
    print("[-] No instances found with key 'aegis_edge_key'. Run redeploy_sensor.py.")
else:
    for r in resp['Reservations']:
        for i in r['Instances']:
            print(f"  ID: {i['InstanceId']}")
            print(f"  State: {i['State']['Name']}")
            print(f"  Public IP: {i.get('PublicIpAddress', 'N/A')}")
            print(f"  Type: {i['InstanceType']}")
            print()
