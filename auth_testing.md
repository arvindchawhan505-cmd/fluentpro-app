# Emergent Auth Testing Playbook

## Step 1: Create Test User & Session
```bash
mongosh --eval "
use('test_database');
var userId = 'test-user-' + Date.now();
var sessionToken = 'test_session_' + Date.now();
db.users.insertOne({
  user_id: userId,
  email: 'test.user.' + Date.now() + '@example.com',
  name: 'Test User',
  picture: 'https://via.placeholder.com/150',
  created_at: new Date()
});
db.user_sessions.insertOne({
  user_id: userId,
  session_token: sessionToken,
  expires_at: new Date(Date.now() + 7*24*60*60*1000),
  created_at: new Date()
});
print('Session token: ' + sessionToken);
print('User ID: ' + userId);
"
```

## Step 2: Backend API tests
```bash
curl -X GET "$API_URL/api/auth/me" -H "Authorization: Bearer YOUR_SESSION_TOKEN"
```

## Step 3: Browser testing
Set cookie `session_token` on domain, path `/`, httpOnly, secure, sameSite=None, navigate to / or /dashboard.

## Checklist
- user_id custom UUID field
- session.user_id matches user.user_id
- All queries exclude `_id` with `{"_id": 0}`
- /api/auth/me returns user data
