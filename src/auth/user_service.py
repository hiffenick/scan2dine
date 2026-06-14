class UserService:
    """
    Service layer for all user-related business logic.
    Handles user creation, authentication, and 2FA updates.
    """

    # =========================
    # USER FETCHING
    # =========================

    @staticmethod
    def get_user_by_id(user_id):
        """
        Get user by ID
        """
        from src.models.admin import User
        return User.query.get(user_id)

    @staticmethod
    def get_user_by_username(username):
        """
        Get user by username or email
        """
        from src.models.admin import User
        return User.query.filter(
            (User.email == username) | (User.name == username)
        ).first()

    # =========================
    # USER CREATION
    # =========================

    @staticmethod
    def create_user(username, email, password):
        """
        Create a new user with hashed password
        Returns: (success: bool, message: str)
        """
        from src.models.admin import User
        from src.extensions import db
        import bcrypt

        # Check if user already exists
        existing_user = User.query.filter(
            (User.email == email) | (User.name == username)
        ).first()

        if existing_user:
            return False, "User already exists"

        # Hash password using bcrypt
        password_bytes = password.encode("utf-8")
        hashed_password = bcrypt.hashpw(password_bytes, bcrypt.gensalt())

        # Create user
        user = User(
            name=username,
            email=email,
            password=hashed_password.decode("utf-8"),
            totp_enable=False
        )

        db.session.add(user)
        db.session.commit()

        return True, "User created successfully"

    # =========================
    # AUTHENTICATION
    # =========================

    @staticmethod
    def verify_password(user, password):
        """
        Verify a user's password using bcrypt
        """
        import bcrypt

        password_bytes = password.encode("utf-8")
        hashed_password_bytes = user.password.encode("utf-8")

        return bcrypt.checkpw(password_bytes, hashed_password_bytes)

    # =========================
    # 2FA MANAGEMENT
    # =========================

    @staticmethod
    def update_user_2fa(user_id, enable):
        """
        Enable or disable 2FA for a user
        Returns: (success: bool, message: str)
        """
        from src.extensions import db

        user = UserService.get_user_by_id(user_id)
        if not user:
            return False, "User not found"

        user.totp_enable = enable
        db.session.commit()

        return True, "2FA settings updated successfully"
