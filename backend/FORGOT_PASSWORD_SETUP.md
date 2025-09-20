# Forgot Password Feature Setup

This document explains how to set up the forgot password feature that has been added to your BookHub application.

## Features Added

1. **Backend Implementation:**
   - Added password reset fields to User model (`resetPasswordToken`, `resetPasswordExpires`)
   - Created password reset token generation method
   - Added email service for sending reset links
   - Created API endpoints for forgot password and reset password

2. **Frontend Implementation:**
   - Created ForgotPassword component (`/forgot-password`)
   - Created ResetPassword component (`/reset-password`)
   - Updated Login component with "Forgot password?" link
   - Added password reset methods to auth service

## Email Configuration

To enable email functionality, you need to configure your email settings:

### 1. Gmail Setup (Recommended)

1. **Enable 2-Factor Authentication** on your Gmail account
2. **Generate an App Password:**
   - Go to Google Account settings
   - Security → 2-Step Verification → App passwords
   - Generate a new app password for "Mail"
   - Copy the generated password

3. **Update your `.env` file:**
```env
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_16_character_app_password
CLIENT_URL=http://localhost:3000
```

### 2. Other Email Services

You can modify `backend/utils/emailService.js` to use other email services like:
- Outlook/Hotmail
- Yahoo Mail
- Custom SMTP server

Example for custom SMTP:
```javascript
const transporter = nodemailer.createTransporter({
  host: 'your-smtp-server.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});
```

## How It Works

1. **User requests password reset:**
   - User clicks "Forgot password?" on login page
   - Enters email address
   - System generates secure token and sends email

2. **User resets password:**
   - User clicks link in email
   - Enters new password
   - System validates token and updates password
   - User receives confirmation email

## Security Features

- **Token Expiration:** Reset tokens expire after 10 minutes
- **Secure Tokens:** Uses crypto.randomBytes for token generation
- **Hashed Storage:** Tokens are hashed before storing in database
- **Email Validation:** Validates email format and existence
- **Password Requirements:** Enforces minimum password length

## Testing

1. **Start the backend server:**
   ```bash
   cd backend
   npm run dev
   ```

2. **Start the frontend server:**
   ```bash
   cd frontend
   npm run dev
   ```

3. **Test the flow:**
   - Go to `/login`
   - Click "Forgot password?"
   - Enter a registered email
   - Check your email for the reset link
   - Click the link and set a new password

## Troubleshooting

### Email not sending:
- Check your email credentials in `.env`
- Ensure 2FA is enabled and app password is correct
- Check console logs for error messages

### Token invalid/expired:
- Tokens expire after 10 minutes
- User must request a new reset link
- Check if `CLIENT_URL` is correctly set

### Frontend not loading:
- Ensure all new components are properly imported
- Check browser console for errors
- Verify routes are added to App.jsx

## Files Modified/Created

### Backend:
- `backend/models/User.js` - Added reset fields and token method
- `backend/routes/auth.js` - Added forgot/reset password endpoints
- `backend/utils/emailService.js` - Email service for sending reset links
- `backend/env.example` - Added email configuration variables

### Frontend:
- `frontend/src/pages/Auth/ForgotPassword.jsx` - Forgot password page
- `frontend/src/pages/Auth/ResetPassword.jsx` - Reset password page
- `frontend/src/pages/Auth/Login.jsx` - Added forgot password link
- `frontend/src/services/authService.js` - Added password reset methods
- `frontend/src/App.jsx` - Added new routes

## Dependencies Added

- `nodemailer` - For sending emails (backend)

The forgot password feature is now fully integrated into your BookHub application!
