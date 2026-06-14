import re
from flask_wtf import FlaskForm
from wtforms import StringField,PasswordField,SubmitField,ValidationError,EmailField,SelectField,DecimalField,TextAreaField,IntegerField
from wtforms.validators import InputRequired,Length,DataRequired,EqualTo,NumberRange

def strongpassword(form, field):
    password = field.data
    if not re.search(r'[A-Z]',password):
        raise ValidationError('Password must contain Atlest One UpperCase Latter')
    if re.search(r'\s',password):
        raise ValidationError('Password Must Not Contain WhiteSpaces')
    if not re.search(r'\d',password):
        raise ValidationError('Password Must Contain Atlest One Number')
    if not re.search(r'[!@#$%^&*()_+?<>]',password):
        raise ValidationError('Password Must Contain Atlest One Special Character')
    
class LoginForm(FlaskForm):
    username = StringField('Name',validators=[InputRequired(),])
    password = PasswordField('Password',validators=[InputRequired(),Length(min=8)])
    submit = SubmitField('Login')

class Signup(FlaskForm):
    username = StringField('Name', validators=[InputRequired()])
    email = EmailField('Email',validators=[InputRequired()])
    password = PasswordField('password',validators=[InputRequired(),Length(min=8),strongpassword])
    confirm_password = PasswordField('confirm_password',validators=[InputRequired(),Length(min=8),EqualTo('password', message='Passwords must match 💔'),strongpassword])
    submit = SubmitField('Signup')

class VerifyForm(FlaskForm):
    verify_code = StringField(
        "Verify Code",
        validators=[DataRequired(), Length(min=6, max=6)]
    )
    submit = SubmitField("Verify Code")

class CSRForm(FlaskForm):
    pass

class MenuItemForm(FlaskForm):
    item_name = StringField("Dish Name",validators=[DataRequired(), Length(min=2, max=50)],render_kw={"placeholder": "Dish Name"})

    category = SelectField("Category",choices=[
            ("Beverage", "Beverage"),
            ("Snacks", "Snacks"),
            ("Main Course", "Main Course"),
            ("Dessert", "Dessert")
        ],
        validators=[DataRequired()],
        render_kw={"placeholder": "Category"}
    )

    item_price = DecimalField("Price",validators=[DataRequired(), NumberRange(min=1)],render_kw={"placeholder": "Dish Price"})

    description = TextAreaField("Description",validators=[Length(max=255)],render_kw={"placeholder": "Description",})

    submit = SubmitField("Save",render_kw={"class": "btn-primary"})


class MenuEditForm(FlaskForm):
    item_name = StringField('Dish Name', validators=[DataRequired(), Length(max=100)])
    item_price = DecimalField('Price', validators=[DataRequired(), NumberRange(min=0)])
    category = SelectField('Category', choices=[('Beverage', 'Beverage'), ('Snaks', 'Snaks'), ('Main Course', 'Main Course')])
    description = TextAreaField('Description', validators=[Length(max=250)])

class CustomerEntryForm(FlaskForm):
    customer_name = StringField(
        "Name",
        validators=[DataRequired(), Length(min=2, max=50)]
    )
    guest_count = IntegerField(
        "Guests",
        validators=[DataRequired(), NumberRange(min=1, max=20)]
    )
    submit = SubmitField("Continue")