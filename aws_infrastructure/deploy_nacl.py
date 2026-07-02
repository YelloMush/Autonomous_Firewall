import boto3
import os

def deploy_aegis_nacl():
    ec2 = boto3.client('ec2', region_name='ap-south-1')
    
    # 1. Read the IDs generated from our last script
    config = {}
    try:
        with open("aegis_config.txt", "r") as f:
            for line in f:
                if "=" in line:
                    key, val = line.strip().split("=")
                    config[key] = val
    except FileNotFoundError:
        print("[!] aegis_config.txt not found. Run deploy_vpc.py first.")
        return

    vpc_id = config.get("VPC_ID")
    subnet_id = config.get("SUBNET_ID")
    
    if not vpc_id or not subnet_id:
        print("[!] Missing VPC_ID or SUBNET_ID in config file.")
        return

    try:
        print(f"[*] 1. Creating Custom NACL in VPC: {vpc_id}...")
        nacl_response = ec2.create_network_acl(VpcId=vpc_id)
        nacl_id = nacl_response['NetworkAcl']['NetworkAclId']
        
        # Tag the NACL
        ec2.create_tags(Resources=[nacl_id], Tags=[{'Key': 'Name', 'Value': 'Aegis-Enforcement-NACL'}])
        print(f"[+] NACL Created: {nacl_id}")

        print("[*] 2. Creating Baseline ALLOW ALL Rules...")
        # Outbound ALLOW ALL (Rule 100)
        ec2.create_network_acl_entry(
            NetworkAclId=nacl_id, RuleNumber=100, Protocol='-1', RuleAction='allow',
            Egress=True, CidrBlock='0.0.0.0/0'
        )
        # Inbound ALLOW ALL (Rule 100) - Your AI will inject DENY rules at numbers lower than 100!
        ec2.create_network_acl_entry(
            NetworkAclId=nacl_id, RuleNumber=100, Protocol='-1', RuleAction='allow',
            Egress=False, CidrBlock='0.0.0.0/0'
        )
        print("[+] Baseline ALLOW rules established.")

        print("[*] 3. Associating NACL with Edge Subnet...")
        # Find the current association ID for the subnet
        assoc_response = ec2.describe_network_acls(
            Filters=[{'Name': 'association.subnet-id', 'Values': [subnet_id]}]
        )
        if assoc_response['NetworkAcls']:
            current_assoc_id = assoc_response['NetworkAcls'][0]['Associations'][0]['NetworkAclAssociationId']
            # Replace the default association with our new custom NACL
            ec2.replace_network_acl_association(AssociationId=current_assoc_id, NetworkAclId=nacl_id)
            print(f"[+] Subnet {subnet_id} successfully bound to NACL {nacl_id}.")

        print("\n========================================")
        print("✅ FIREWALL ENFORCEMENT LAYER DEPLOYED")
        print("========================================")
        
        # Save the NACL ID for your ML engine to use
        with open("aegis_config.txt", "a") as f:
            f.write(f"\nNACL_ID={nacl_id}\n")

    except Exception as e:
        print(f"\n[!] Deployment failed: {e}")

if __name__ == "__main__":
    deploy_aegis_nacl()