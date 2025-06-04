// Initialize the Amazon Cognito credentials provider
const userPool = new AmazonCognitoIdentity.CognitoUserPool({
  UserPoolId: awsConfig.userPoolId,
  ClientId: awsConfig.userPoolWebClientId
});

// DOM Elements
const authSection = document.getElementById('auth-section');
const appSection = document.getElementById('app-section');
const adminSection = document.getElementById('admin-section');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const confirmForm = document.getElementById('confirm-form');
const showRegisterLink = document.getElementById('show-register');
const showLoginLink = document.getElementById('show-login');
const showLoginFromConfirmLink = document.getElementById('show-login-from-confirm');
const userName = document.getElementById('user-name');
const userRole = document.getElementById('user-role');
const logoutButton = document.getElementById('logout-button');
const tasksContainer = document.getElementById('tasks-container');
const statusFilter = document.getElementById('status-filter');
const priorityFilter = document.getElementById('priority-filter');

// Current user session
let currentUser = null;
let isAdmin = false;
let idToken = null;

// Event Listeners
document.addEventListener('DOMContentLoaded', checkSession);
showRegisterLink.addEventListener('click', showRegisterForm);
showLoginLink.addEventListener('click', showLoginForm);
showLoginFromConfirmLink.addEventListener('click', showLoginForm);
logoutButton.addEventListener('click', logout);

// Login form submission
document.getElementById('login-button').addEventListener('click', () => {
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  login(email, password);
});

// Register form submission
document.getElementById('register-button').addEventListener('click', () => {
  const name = document.getElementById('register-name').value;
  const email = document.getElementById('register-email').value;
  const password = document.getElementById('register-password').value;
  register(name, email, password);
});

// Confirmation form submission
document.getElementById('confirm-button').addEventListener('click', confirmRegistration);

// Create task button (for admins)
const createTaskButton = document.getElementById('create-task-button');
if (createTaskButton) {
  createTaskButton.addEventListener('click', createTask);
}

// Filter change events
statusFilter.addEventListener('change', filterTasks);
priorityFilter.addEventListener('change', filterTasks);

// Show login form
function showLoginForm() {
  loginForm.classList.remove('hidden');
  registerForm.classList.add('hidden');
  confirmForm.classList.add('hidden');
}

// Show register form
function showRegisterForm() {
  loginForm.classList.add('hidden');
  registerForm.classList.remove('hidden');
  confirmForm.classList.add('hidden');
}

// Show confirmation form
function showConfirmationForm() {
  loginForm.classList.add('hidden');
  registerForm.classList.add('hidden');
  confirmForm.classList.remove('hidden');
}

// Check if user is already logged in
function checkSession() {
  const cognitoUser = userPool.getCurrentUser();
  
  if (cognitoUser != null) {
    cognitoUser.getSession((err, session) => {
      if (err) {
        console.error('Error getting session:', err);
        return;
      }
      
      if (session.isValid()) {
        idToken = session.getIdToken().getJwtToken();
        
        // Get user attributes
        cognitoUser.getUserAttributes((err, attributes) => {
          if (err) {
            console.error('Error getting user attributes:', err);
            return;
          }
          
          const nameAttribute = attributes.find(attr => attr.Name === 'name');
          if (nameAttribute) {
            currentUser = {
              email: cognitoUser.getUsername(),
              name: nameAttribute.Value
            };
            
            // Check if user is admin
            const payload = parseJwt(idToken);
            isAdmin = payload['cognito:groups'] && payload['cognito:groups'].includes('Admins');
            
            // Update UI
            showApp();
          }
        });
      }
    });
  }
}

// Login function
function login(email, password) {
  const authenticationData = {
    Username: email,
    Password: password
  };
  
  const authenticationDetails = new AmazonCognitoIdentity.AuthenticationDetails(authenticationData);
  
  const userData = {
    Username: email,
    Pool: userPool
  };
  
  const cognitoUser = new AmazonCognitoIdentity.CognitoUser(userData);
  
  cognitoUser.authenticateUser(authenticationDetails, {
    onSuccess: function(result) {
      idToken = result.getIdToken().getJwtToken();
      
      // Get user attributes
      cognitoUser.getUserAttributes((err, attributes) => {
        if (err) {
          console.error('Error getting user attributes:', err);
          return;
        }
        
        const nameAttribute = attributes.find(attr => attr.Name === 'name');
        if (nameAttribute) {
          currentUser = {
            email: email,
            name: nameAttribute.Value
          };
          
          // Check if user is admin
          const payload = parseJwt(idToken);
          isAdmin = payload['cognito:groups'] && payload['cognito:groups'].includes('Admins');
          
          // Update UI
          showApp();
        }
      });
    },
    onFailure: function(err) {
      alert('Error during login: ' + err.message);
    }
  });
}

// Register function
function register(name, email, password) {
  const attributeList = [
    new AmazonCognitoIdentity.CognitoUserAttribute({
      Name: 'name',
      Value: name
    }),
    new AmazonCognitoIdentity.CognitoUserAttribute({
      Name: 'email',
      Value: email
    })
    // Removed custom:role attribute that was causing the error
  ];
  
  userPool.signUp(email, password, attributeList, null, (err, result) => {
    if (err) {
      alert('Error during registration: ' + err.message);
      return;
    }
    
    // Pre-fill the email in the confirmation form
    document.getElementById('confirm-email').value = email;
    
    // Show confirmation form
    showConfirmationForm();
    
    alert('Registration successful! Please check your email for verification code.');
  });
}

// Confirm registration function
function confirmRegistration() {
  const email = document.getElementById('confirm-email').value;
  const code = document.getElementById('confirm-code').value;
  
  const userData = {
    Username: email,
    Pool: userPool
  };
  
  const cognitoUser = new AmazonCognitoIdentity.CognitoUser(userData);
  
  cognitoUser.confirmRegistration(code, true, function(err, result) {
    if (err) {
      alert('Error confirming registration: ' + err.message);
      return;
    }
    alert('Registration confirmed! You can now log in.');
    showLoginForm();
  });
}

// Logout function
function logout() {
  const cognitoUser = userPool.getCurrentUser();
  if (cognitoUser) {
    cognitoUser.signOut();
    currentUser = null;
    isAdmin = false;
    idToken = null;
    showAuth();
  }
}

// Show app after successful login
function showApp() {
  authSection.classList.add('hidden');
  appSection.classList.remove('hidden');
  
  // Update user info
  userName.textContent = currentUser.name;
  userRole.textContent = isAdmin ? 'Admin' : 'Team Member';
  
  // Show admin section if user is admin
  if (isAdmin) {
    adminSection.classList.remove('hidden');
    loadTeamMembers();
  } else {
    adminSection.classList.add('hidden');
  }
  
  // Load tasks
  loadTasks();
}

// Show auth section after logout
function showAuth() {
  authSection.classList.remove('hidden');
  appSection.classList.add('hidden');
}

// Load tasks from API
function loadTasks() {
  fetch(`${awsConfig.apiEndpoint}/tasks`, {
    headers: {
      'Authorization': idToken,
      'Content-Type': 'application/json'
    },
    mode: 'cors'
  })
  .then(response => {
    if (!response.ok) {
      throw new Error('Failed to load tasks');
    }
    return response.json();
  })
  .then(tasks => {
    displayTasks(tasks);
  })
  .catch(error => {
    console.error('Error loading tasks:', error);
    alert('Error loading tasks. Please try again.');
  });
}

// Display tasks in the UI
function displayTasks(tasks) {
  tasksContainer.innerHTML = '';
  
  if (tasks.length === 0) {
    tasksContainer.innerHTML = '<p>No tasks found.</p>';
    return;
  }
  
  const statusValue = statusFilter.value;
  const priorityValue = priorityFilter.value;
  
  const filteredTasks = tasks.filter(task => {
    const statusMatch = statusValue === 'all' || task.status === statusValue;
    const priorityMatch = priorityValue === 'all' || task.priority === priorityValue;
    return statusMatch && priorityMatch;
  });
  
  if (filteredTasks.length === 0) {
    tasksContainer.innerHTML = '<p>No tasks match the selected filters.</p>';
    return;
  }
  
  filteredTasks.forEach(task => {
    const taskCard = document.createElement('div');
    taskCard.className = 'task-card';
    
    const deadlineDate = new Date(task.deadline);
    const today = new Date();
    const isOverdue = deadlineDate < today && task.status !== 'completed';
    
    taskCard.innerHTML = `
      <h3>${task.title}</h3>
      <p>${task.description || 'No description'}</p>
      <div class="task-meta">
        <span class="task-priority priority-${task.priority}">${task.priority}</span>
        <span class="deadline ${isOverdue ? 'overdue' : ''}">
          Due: ${deadlineDate.toLocaleDateString()}
        </span>
      </div>
      <div class="task-status">
        <select class="status-select" data-task-id="${task.taskId}">
          <option value="pending" ${task.status === 'pending' ? 'selected' : ''}>Pending</option>
          <option value="in-progress" ${task.status === 'in-progress' ? 'selected' : ''}>In Progress</option>
          <option value="completed" ${task.status === 'completed' ? 'selected' : ''}>Completed</option>
        </select>
      </div>
    `;
    
    tasksContainer.appendChild(taskCard);
    
    // Add event listener to status select
    const statusSelect = taskCard.querySelector('.status-select');
    statusSelect.addEventListener('change', (e) => {
      updateTaskStatus(e.target.dataset.taskId, e.target.value);
    });
  });
}

// Filter tasks
function filterTasks() {
  loadTasks();
}

// Update task status
function updateTaskStatus(taskId, status) {
  fetch(`${awsConfig.apiEndpoint}/tasks/${taskId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': idToken
    },
    mode: 'cors',
    body: JSON.stringify({ status })
  })
  .then(response => {
    if (!response.ok) {
      throw new Error('Failed to update task status');
    }
    return response.json();
  })
  .then(updatedTask => {
    console.log('Task updated:', updatedTask);
  })
  .catch(error => {
    console.error('Error updating task:', error);
    alert('Error updating task status. Please try again.');
    loadTasks(); // Reload tasks to reset UI
  });
}

// Create a new task (admin only)
function createTask() {
  const title = document.getElementById('task-title').value;
  const description = document.getElementById('task-description').value;
  const assignedTo = document.getElementById('task-assignee').value;
  const deadline = document.getElementById('task-deadline').value;
  const priority = document.getElementById('task-priority').value;
  
  if (!title || !assignedTo || !deadline) {
    alert('Please fill in all required fields.');
    return;
  }
  
  const task = {
    title,
    description,
    assignedTo,
    deadline,
    priority
  };
  
  fetch(`${awsConfig.apiEndpoint}/tasks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': idToken
    },
    mode: 'cors',
    body: JSON.stringify(task)
  })
  .then(response => {
    if (!response.ok) {
      throw new Error('Failed to create task');
    }
    return response.json();
  })
  .then(newTask => {
    console.log('Task created:', newTask);
    
    // Clear form
    document.getElementById('task-title').value = '';
    document.getElementById('task-description').value = '';
    document.getElementById('task-assignee').value = '';
    document.getElementById('task-deadline').value = '';
    document.getElementById('task-priority').value = 'medium';
    
    // Reload tasks
    loadTasks();
  })
  .catch(error => {
    console.error('Error creating task:', error);
    alert('Error creating task. Please try again.');
  });
}

// Load team members for admin task assignment
function loadTeamMembers() {
  // In a real application, you would fetch team members from an API
  // For this example, we'll use a placeholder
  const assigneeSelect = document.getElementById('task-assignee');
  
  // Clear existing options
  assigneeSelect.innerHTML = '<option value="">Assign To...</option>';
  
  // Add placeholder team members
  const teamMembers = [
    { email: 'team1@example.com', name: 'Team Member 1' },
    { email: 'team2@example.com', name: 'Team Member 2' },
    { email: 'team3@example.com', name: 'Team Member 3' }
  ];
  
  teamMembers.forEach(member => {
    const option = document.createElement('option');
    option.value = member.email;
    option.textContent = member.name;
    assigneeSelect.appendChild(option);
  });
}

// Helper function to parse JWT token
function parseJwt(token) {
  const base64Url = token.split('.')[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
    return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
  }).join(''));
  
  return JSON.parse(jsonPayload);
}