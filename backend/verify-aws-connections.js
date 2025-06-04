const AWS = require('aws-sdk');

// Configure AWS SDK
const region = process.env.AWS_REGION || 'eu-west-1';
AWS.config.update({ region });

// Initialize AWS services
const dynamoDB = new AWS.DynamoDB.DocumentClient();
const ses = new AWS.SES();

// Environment variables
const TASKS_TABLE = process.env.TASKS_TABLE || 'Tasks';

async function verifyConnections() {
  console.log('Verifying AWS connections...');
  console.log(`Region: ${region}`);
  console.log(`Tasks Table: ${TASKS_TABLE}`);
  
  try {
    // Test DynamoDB connection
    console.log('\nTesting DynamoDB connection...');
    const dynamoResult = await dynamoDB.scan({
      TableName: TASKS_TABLE,
      Limit: 1
    }).promise();
    
    console.log('DynamoDB connection successful!');
    console.log(`Found ${dynamoResult.Count} items in the ${TASKS_TABLE} table`);
    
    // Test SES connection
    console.log('\nTesting SES connection...');
    const sesResult = await ses.getSendQuota().promise();
    
    console.log('SES connection successful!');
    console.log(`SES Send Quota: ${sesResult.Max24HourSend} emails per 24 hours`);
    console.log(`SES Sent Last 24 Hours: ${sesResult.SentLast24Hours} emails`);
    
    console.log('\nAll AWS connections verified successfully!');
  } catch (error) {
    console.error('Error verifying AWS connections:', error);
  }
}

verifyConnections();