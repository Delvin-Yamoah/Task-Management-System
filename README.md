# Task Management System

A serverless task management system for field teams built with AWS App Runner and AWS Amplify.

## Architecture

- **Authentication**: Amazon Cognito
- **Backend**: Express.js on AWS App Runner
- **Database**: Amazon DynamoDB
- **Frontend**: Static HTML/CSS/JS hosted on AWS Amplify

## Features

- User authentication (Admin and Team Member roles)
- Task creation and assignment
- Task status updates
- Email notifications for task assignments and updates
- Dashboard for task overview and statistics

## Project Structure

```
Task-Management-System/
├── backend/                 # Express.js application
│   ├── app.js               # Main application file
│   └── package.json         # Node.js dependencies
├── frontend/                # Web application
│   ├── app.js               # Main application logic
│   ├── dashboard.html       # Dashboard interface
│   ├── index.html           # Main interface
│   └── styles.css           # CSS styling
├── apprunner.yaml           # App Runner configuration
└── amplify.yml              # Amplify configuration
```

## Deployment Instructions

### 1. Create DynamoDB Table

```bash
aws dynamodb create-table \
  --table-name Tasks \
  --attribute-definitions \
    AttributeName=taskId,AttributeType=S \
    AttributeName=assignedTo,AttributeType=S \
  --key-schema AttributeName=taskId,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --global-secondary-indexes \
    IndexName=AssignedToIndex,KeySchema=["{AttributeName=assignedTo,KeyType=HASH}"],Projection="{ProjectionType=ALL}" \
  --region eu-west-1
```

### 2. Create Cognito User Pool

```bash
aws cognito-idp create-user-pool \
  --pool-name TaskManagementUserPool \
  --auto-verified-attributes email \
  --schema Name=email,Required=true,Mutable=true Name=name,Required=true,Mutable=true \
  --username-attributes email \
  --region eu-west-1
```

### 3. Deploy Backend to App Runner

1. Push code to GitHub
2. Create App Runner service from GitHub repository
3. Configure environment variables:
   - AWS_REGION: eu-west-1
   - TASKS_TABLE: Tasks
   - USER_POOL_ID: (from Cognito)
   - SENDER_EMAIL: (verified email for notifications)
   - FRONTEND_URL: (Amplify URL after deployment)

### 4. Deploy Frontend to Amplify

1. Connect GitHub repository to Amplify
2. Configure build settings using amplify.yml
3. Update frontend/config.js with:
   - API endpoint from App Runner
   - Cognito User Pool ID and Client ID

## Demo Mode

A fully functional demo version is available that works entirely in the browser using localStorage instead of API calls:

- Access the demo at: `index-demo.html`
- Login with: `admin@example.com` (any password works in demo mode)
- Create and manage tasks without backend dependencies
- View task statistics in the dashboard