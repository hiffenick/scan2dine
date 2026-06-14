class UserValidator:
    @staticmethod
    def is_valid_email(email):
        return "@" in email and "." in email

    @staticmethod
    def is_strong_password(password):
        import re
        return len(password) >= 8 and re.search(r"[A-Z]", password)
