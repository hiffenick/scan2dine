"""
Authentication utilities module
Handles all authentication-related operations
"""
from src.models.admin import User
from src.extensions import db, bcrypt
from flask import current_app


class UserValidator:
    """Validate user data before creating user account"""
    
    @staticmethod
    def email_exists(email):
        """Check if email is already registered"""
        return User.query.filter_by(email=email).first() is not None
    
    @staticmethod
    def username_exists(username):
        """Check if username is already taken"""
        return User.query.filter_by(name=username).first() is not None
    
    @staticmethod
    def validate_signup_data(username, email, password):
        """
        Validate all signup data
        Returns: (is_valid, error_message)
        """
        # Check if username is taken
        if UserValidator.username_exists(username):
            return False, "Username already taken"
        
        # Check if email is registered
        if UserValidator.email_exists(email):
            return False, "Email already registered"
        
        # Check username format
        if len(username) < 3:
            return False, "Username must be at least 3 characters"
        
        if len(username) > 50:
            return False, "Username must be less than 50 characters"
        
        # Validate email format
        if not UserValidator.validate_email_format(email):
            return False, "Invalid email format"
        
        return True, None
    
    @staticmethod
    def validate_email_format(email):
        """Basic email format validation"""
        import re
        pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        return re.match(pattern, email) is not None


class UserService:
    """Service for user-related operations"""
    
    @staticmethod
    def create_user(username, email, password):
        """
        Create a new user
        Returns: (success, user_or_error_message)
        """
        try:
            import pyotp
            from flask import current_app
            
            # Validate input data
            is_valid, error_msg = UserValidator.validate_signup_data(username, email, password)
            if not is_valid:
                return False, error_msg
            
            # Hash password
            hashed_password = bcrypt.generate_password_hash(password).decode('utf-8')
            
            # Generate TOTP secret for 2FA
            totp_secret = pyotp.random_base32()
            
            # Create new user
            new_user = User(
                name=username,
                email=email,
                password=hashed_password,
                totp_secret=totp_secret,
                totp_enable=False
            )
            
            # Save to database
            db.session.add(new_user)
            db.session.commit()
            
            current_app.logger.info(f"User {username} created successfully")
            return True, new_user
            
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"Error creating user: {str(e)}")
            return False, f"Error creating user: {str(e)}"
    
    @staticmethod
    def get_user_by_email(email):
        """Get user by email"""
        return User.query.filter_by(email=email).first()
    
    @staticmethod
    def get_user_by_username(username):
        """Get user by username"""
        return User.query.filter_by(name=username).first()
    
    @staticmethod
    def get_user_by_id(user_id):
        """Get user by ID"""
        return User.query.get(user_id)
    
    @staticmethod
    def verify_password(user, password):
        """Verify user password"""
        return bcrypt.check_password_hash(user.password, password)
    
    @staticmethod
    def update_user_2fa(user_id, totp_enabled):
        """Update user 2FA status"""
        try:
            user = User.query.get(user_id)
            if user:
                user.totp_enable = totp_enabled
                db.session.commit()
                return True, "2FA status updated"
            return False, "User not found"
        except Exception as e:
            db.session.rollback()
            return False, f"Error updating 2FA: {str(e)}"


class SessionManager:
    """Manage user sessions"""
    
    @staticmethod
    def create_pre_2fa_session(session_obj, user_id):
        """Create pre-2FA session (after password validation, before 2FA)"""
        session_obj['pre2fa_userid'] = user_id
        return True
    
    @staticmethod
    def create_user_session(session_obj, user):
        """Create full user session (after 2FA verification)"""
        session_obj['user_id'] = user.id
        session_obj['username'] = user.name
        session_obj['user_email'] = user.email
        return True
    
    @staticmethod
    def clear_session(session_obj):
        """Clear all session data"""
        session_obj.clear()
        return True
    
    @staticmethod
    def get_pre_2fa_user_id(session_obj):
        """Get user ID from pre-2FA session"""
        return session_obj.get('pre2fa_userid')
    
    @staticmethod
    def is_authenticated(session_obj):
        """Check if user is authenticated"""
        return 'user_id' in session_obj
