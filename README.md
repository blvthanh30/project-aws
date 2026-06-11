# VOIDX Shop

VOIDX Shop is a Node.js e-commerce website deployed on AWS.
This project demonstrates both traditional cloud deployment and serverless architecture using multiple AWS services.

## Quick AWS Deployment

* Deployment guide: [DEPLOY_AWS.md](DEPLOY_AWS.md)
* Sample user-data script: [deploy/aws-user-data.sh](deploy/aws-user-data.sh)
* EC2 setup script: `setup-ec2.sh`

## AWS Deployment URLs

### EC2 Public IP

http://54.82.32.74:80

### Application Load Balancer

http://voidx-target-group-1889077742.us-east-1.elb.amazonaws.com

### CloudFront CDN

http://d1paq7pcq1pa6q.cloudfront.net

> Note: This project was deployed in AWS Academy Learner Lab. These URLs may stop working if the lab environment is reset.

## Main Website Architecture

User
→ CloudFront
→ Application Load Balancer
→ EC2
→ Nginx
→ Node.js VOIDX Website

## AWS Services Used for Website Deployment

| AWS Service               | Purpose in Project                                        |
| ------------------------- | --------------------------------------------------------- |
| Amazon EC2                | Hosts the Node.js VOIDX website                           |
| Nginx                     | Reverse proxy from port 80 to Node.js port 3000           |
| Application Load Balancer | Routes HTTP traffic to the EC2 instance                   |
| Target Group              | Performs health checks for the EC2 instance               |
| CloudFront                | CDN/cache layer in front of the Load Balancer             |
| EBS Snapshot              | Backs up the EC2 volume                                   |
| Security Group            | Controls inbound traffic such as SSH, HTTP, and app ports |
| GitHub                    | Stores source code and deployment scripts                 |

## EC2 Deployment Summary

The website source code was cloned from GitHub to an Amazon EC2 instance running Amazon Linux 2023. The Node.js application runs on port 3000.

Nginx was configured as a reverse proxy so users can access the website through HTTP port 80.

Flow:

User
→ EC2 Public IP / Load Balancer
→ Nginx port 80
→ Node.js app port 3000

## Application Load Balancer

An Application Load Balancer was created to forward traffic to the EC2 web server.

The Target Group was configured with:

* Protocol: HTTP
* Port: 80
* Target type: Instance
* Health check path: `/`

The EC2 instance was registered as a target and reached `Healthy` status.

## CloudFront CDN

Amazon CloudFront was configured in front of the Application Load Balancer.

CloudFront uses the Load Balancer DNS as the origin. This creates the following flow:

User
→ CloudFront
→ Application Load Balancer
→ EC2
→ Nginx
→ Node.js website

The website was successfully accessed through the CloudFront domain.

## EBS Snapshot

The EC2 instance uses an EBS volume to store the operating system, project source code, dependencies, and configuration files.

An EBS Snapshot was created to back up the EC2 volume. This demonstrates backup and recovery planning for the deployed server.

## AWS Academy Note

This project was deployed in AWS Academy Learner Lab.

Because AWS Academy resources may reset after the lab session, the following items are saved as evidence and recovery documentation:

* GitHub source code
* Deployment scripts
* README documentation
* Screenshots of deployed AWS resources
* Screenshots of working website URLs

If the AWS environment is reset, the website can be rebuilt using the GitHub repository and setup script.

## Rebuild Commands

After creating a new Amazon Linux EC2 instance, run:

```bash
sudo dnf install git -y
git clone https://github.com/blvthanh30/project-aws.git
cd project-aws
chmod +x setup-ec2.sh
bash setup-ec2.sh
```

Then access the website using the new EC2 Public IPv4 address.

## Serverless Order Processing Workflow

The VOIDX project also includes a serverless order processing workflow using API Gateway, Lambda, DynamoDB, SQS, and SNS.

## Serverless Flow

User / Website
→ API Gateway `POST /orders`
→ Lambda `voidx-create-order`
→ DynamoDB `Orders` table
→ SQS `voidx-order-queue`
→ SNS `voidx-order-topic`

## AWS Serverless Services Used

| AWS Service        | Purpose in Serverless Workflow                    |
| ------------------ | ------------------------------------------------- |
| Amazon API Gateway | Exposes the `POST /orders` API endpoint           |
| AWS Lambda         | Handles order creation logic                      |
| Amazon DynamoDB    | Stores order data in the `Orders` table           |
| Amazon SQS         | Stores order messages for asynchronous processing |
| Amazon SNS         | Sends order notification messages to subscribers  |

## API Endpoint

```txt
POST /orders
```

The API receives order data such as customer name, product name, and quantity.

Lambda processes the request, stores the order in DynamoDB, sends a message to SQS, and publishes a notification through SNS.

## Example Request

```json
{
  "customerName": "VOIDX Test",
  "productName": "VOIDX Oversize Tee",
  "quantity": 1
}
```

## Expected Serverless Result

After submitting an order request:

1. API Gateway receives the HTTP request.
2. Lambda processes the order.
3. DynamoDB stores the order record.
4. SQS receives the order message.
5. SNS publishes an order notification.

## Full AWS Architecture

Main website flow:

User
→ CloudFront
→ Application Load Balancer
→ EC2
→ Nginx
→ Node.js VOIDX Website

Serverless order workflow:

Website / Client
→ API Gateway
→ Lambda
→ DynamoDB
→ SQS
→ SNS

## AWS Services Summary

| AWS Service               | Purpose in Project                                |
| ------------------------- | ------------------------------------------------- |
| Amazon EC2                | Hosts the Node.js VOIDX website                   |
| Nginx                     | Reverse proxy from port 80 to Node.js port 3000   |
| Application Load Balancer | Routes traffic to EC2                             |
| Target Group              | Performs health checks for the EC2 instance       |
| CloudFront                | CDN/cache layer in front of the Load Balancer     |
| EBS Snapshot              | Backs up the EC2 volume                           |
| API Gateway               | Provides the `POST /orders` API endpoint          |
| Lambda                    | Processes order creation                          |
| DynamoDB                  | Stores order data in the `Orders` table           |
| SQS                       | Queues order messages for asynchronous processing |
| SNS                       | Sends order notifications                         |
| Security Group            | Controls inbound traffic                          |
| GitHub                    | Stores source code and deployment documentation   |

## Evidence Screenshots

The following screenshots should be included in the final report:

* EC2 instance running
* Website running through EC2 Public IP
* Website running through Application Load Balancer
* Website running through CloudFront
* Target Group status: Healthy
* EBS Snapshot status: Completed
* API Gateway route: `POST /orders`
* Lambda test result: success
* DynamoDB `Orders` table with order item
* SQS queue message
* SNS topic and subscription
* GitHub repository with deployment documentation

## Conclusion

This project demonstrates a complete AWS deployment architecture for the VOIDX website.

The system includes compute, networking, load balancing, CDN, storage backup, serverless API processing, NoSQL database storage, queue-based messaging, and notification services.

The final implementation includes:

* EC2 website hosting
* Nginx reverse proxy
* Application Load Balancer
* CloudFront CDN
* EBS Snapshot backup
* API Gateway
* Lambda
* DynamoDB
* SQS
* SNS
* GitHub documentation and deployment scripts
