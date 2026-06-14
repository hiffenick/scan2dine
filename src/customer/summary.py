from flask import render_template, session, redirect, url_for
from src.customer import customer_order_bp
from src.models.order import Order  # adjust if your import path is different


# @customer_order_bp.route("/customer/confirmation",methods=['GET','POST'])
# def confirmation_test():
#     return render_template("customer/confirmation.html")


from collections import namedtuple
from flask import render_template
from src.customer import customer_order_bp

from collections import namedtuple
from datetime import datetime
from flask import render_template
from src.customer import customer_order_bp

from collections import namedtuple
from datetime import datetime
from flask import render_template
from src.customer import customer_order_bp

@customer_order_bp.route("/customer/confirmation")
def confirmation_test():
    # Add all expected attributes
    OrderDummy = namedtuple(
        "OrderDummy",
        ["id", "table_number", "items", "total", "total_amount", "subtotal", "tax", "discount", "created_at"]
    )
    
    order = OrderDummy(
        id=123,
        table_number=5,
        items=[{"name": "Pizza", "quantity": 2, "price": 100}],
        total=200,
        total_amount=200,     # ⚡ required for round()
        subtotal=180,
        tax=20,
        discount=0,
        created_at=datetime.now()
    )
    
    return render_template("customer/confirmation.html", order=order)

