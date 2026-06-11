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
## Serverless Order Processing Workflow

The VOIDX project also includes a serverless order processing workflow using API Gateway, Lambda, DynamoDB, SQS, and SNS.

### Serverless Flow

User / Website  
→ API Gateway `POST /orders`  
→ Lambda `voidx-create-order`  
→ DynamoDB `Orders` table  
→ SQS `voidx-order-queue`  
→ SNS `voidx-order-topic`

### AWS Serverless Services Used

- Amazon API Gateway: Exposes the `POST /orders` API endpoint
- AWS Lambda: Handles order creation logic
- Amazon DynamoDB: Stores order data in the `Orders` table
- Amazon SQS: Stores order messages for asynchronous processing
- Amazon SNS: Sends order notification messages to subscribers

### API Endpoint

POST /orders

The API receives order data such as customer name, product name, and quantity. Lambda processes the request, stores the order in DynamoDB, sends a message to SQS, and publishes a notification through SNS.

### Example Request

```json
{
  "customerName": "VOIDX Test",
  "productName": "VOIDX Oversize Tee",
  "quantity": 1
}
