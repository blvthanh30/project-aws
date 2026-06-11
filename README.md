# VOIDX Shop

Deploy AWS nhanh:

- Xem huong dan tai [DEPLOY_AWS.md](DEPLOY_AWS.md)
- Script user-data mau nam tai [deploy/aws-user-data.sh](deploy/aws-user-data.sh)
## AWS Deployment URLs

### EC2 Public IP
http://54.82.32.74:80

### Application Load Balancer
http://voidx-target-group-1889077742.us-east-1.elb.amazonaws.com

### CloudFront CDN
http://d1paq7pcq1pa6q.cloudfront.net

## Final AWS Architecture

User → CloudFront → Application Load Balancer → EC2 → Nginx → Node.js VOIDX Website

## AWS Services Used

- Amazon EC2: Host Node.js website
- Nginx: Reverse proxy from port 80 to Node.js port 3000
- Application Load Balancer: Route traffic to EC2
- Target Group: Health check EC2 instance
- CloudFront: CDN/cache layer in front of ALB
- EBS Snapshot: Backup EC2 volume
- Security Group: Control inbound traffic
- GitHub: Store source code and deployment scripts

## AWS Academy Note

This project was deployed in AWS Academy Learner Lab. Since AWS Academy resources may reset after the lab session, screenshots and deployment scripts are saved as evidence and recovery documentation.
