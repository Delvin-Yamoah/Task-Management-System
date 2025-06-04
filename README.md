# Task Management System

A modern task management application built with a serverless architecture using AWS services. This system allows administrators to create and assign tasks to team members, while team members can view and update the status of their assigned tasks.

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│             │     │             │     │             │
│   AWS       │     │   AWS       │     │   Amazon    │
│   Amplify   │◄────┤ App Runner  │◄────┤  DynamoDB   │
│  (Frontend) │     │ (Backend)   │     │  (Database) │
│             │     │             │     │             │
└─────┬───────┘     └─────┬───────┘     └─────────────┘
      │                   │
      │                   │
      ▼                   ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│             │     │             │     │             │
│   Amazon    │     │   Amazon    │     │   Amazon    │
│   Cognito   │     │     SES     │     │    IAM      │
│   (Auth)    │     │  (Emails)   │     │ (Security)  │
│             │     │             │     │             │
└─────────────┘     └─────────────┘     └─────────────┘
```

## Features

- **User Authentication**: Secure login and registration using Amazon Cognito
- **Role-Based Access Control**: Different permissions for admins and team members
- **Task Management**: Create, view, and update tasks
- **Email Notifications**: Automatic emails for task assignments and status updates
- **Responsive Design**: Works on desktop and mobile devices
- **Dark Theme**: Modern dark and green UI theme

## Technology Stack

### Frontend
- HTML5, CSS3, JavaScript
- Amazon Cognito for authentication
- AWS Amplify for hosting

### Backend
- Node.js with Express
- AWS App Runner for containerized deployment
- Amazon DynamoDB for database
- Amazon SES for email notifications
- Amazon Cognito for user management

## Deployment Architecture

This project uses a modern serverless deployment approach:

1. **Frontend**: Deployed on AWS Amplify
   - Continuous deployment from GitHub repository
   - Global content delivery via CloudFront
   - HTTPS enabled by default

2. **Backend**: Deployed on AWS App Runner
   - Containerized Node.js application
   - Auto-scaling based on demand
   - Managed HTTPS endpoints

3. **Database**: Amazon DynamoDB
   - Serverless NoSQL database
   - Auto-scaling capacity
   - Pay-per-request pricing model

4. **Authentication**: Amazon Cognito
   - User pools for authentication
   - Identity pools for authorization
   - Integration with IAM roles

5. **Email Service**: Amazon SES
   - Transactional emails for notifications
   - Email templates for consistent messaging
   - Delivery monitoring and tracking

## Deployment Instructions

### Prerequisites
- AWS Account
- AWS CLI configured with appropriate permissions
- GitHub repository with your code

### Frontend Deployment (AWS Amplify)
1. Go to AWS Amplify console
2. Click "New app" > "Host web app"
3. Connect to your GitHub repository
4. Configure build settings with amplify.yml
5. Deploy the app

### Backend Deployment (AWS App Runner)
1. Go to AWS App Runner console
2. Create a new service
3. Connect to your GitHub repository
4. Configure the service with apprunner.yaml
5. Set environment variables:
   - FRONTEND_URL: Your Amplify app URL
   - AWS_REGION: e.g., eu-west-1
   - TASKS_TABLE: DynamoDB table name
   - USER_POOL_ID: Cognito User Pool ID
   - SENDER_EMAIL: Verified email for notifications

### Database Setup (DynamoDB)
```bash
aws dynamodb create-table \
  --table-name Tasks \
  --attribute-definitions \
    AttributeName=taskId,AttributeType=S \
  --key-schema AttributeName=taskId,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST
```

### Authentication Setup (Cognito)
```bash
# Create User Pool
aws cognito-idp create-user-pool \
  --pool-name TaskManagementUserPool \
  --auto-verified-attributes email

# Create App Client
aws cognito-idp create-user-pool-client \
  --user-pool-id YOUR_USER_POOL_ID \
  --client-name task-management-app \
  --no-generate-secret

# Create User Groups
aws cognito-idp create-group \
  --user-pool-id YOUR_USER_POOL_ID \
  --group-name Admins

aws cognito-idp create-group \
  --user-pool-id YOUR_USER_POOL_ID \
  --group-name TeamMembers
```

### Email Setup (SES)
1. Verify your sender email address in SES
2. If in sandbox mode, verify recipient emails
3. Request production access if needed

## Security Considerations

- IAM roles with least privilege principle
- Environment variables for sensitive configuration
- CORS configuration to restrict API access
- JWT token validation for API requests
- HTTPS for all communications

## Benefits of This Architecture

- **Scalability**: Automatically scales with demand
- **Cost-Effective**: Pay only for what you use
- **Maintenance**: No server management required
- **Security**: Built-in security features
- **Reliability**: High availability and fault tolerance
- **Developer Experience**: Simplified deployment workflow

## Future Enhancements

- Task attachments using S3
- Real-time notifications using WebSockets
- Mobile application using React Native
- Advanced reporting and analytics
- Integration with calendar systems