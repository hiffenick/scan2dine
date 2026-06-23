from flask import Blueprint, redirect, url_for, render_template, session, request
from src.wtforms import CustomerEntryForm
from src.services.redis_session import create_customer_session, update_customer_session , get_customer_session
from src.services.qr_token import validate_token, lock_table, get_table_lock

greeting = Blueprint("greeting", __name__, url_prefix="/customer")


@greeting.route('/table/<int:table_number>', methods=['GET', 'POST'])
def customer_menu(table_number):
    if table_number < 1 or table_number > 100:
        return redirect(url_for('greeting.invalid'))

    existing_session_id = session.get('session_id')
    existing_table = session.get('table_no')
    token_verified = session.get('token_verified')

    print(f"\n{'='*50}")
    print(f"TABLE {table_number} REQUEST — method={request.method}")
    print(f"existing_session_id: {existing_session_id}")
    print(f"existing_table: {existing_table}")
    print(f"token_verified: {token_verified}")

    already_has_session = (
        existing_session_id and
        existing_table == table_number and
        token_verified
    )
    print(f"already_has_session: {already_has_session}")

    # ✅ Bug 3 fix — if they have a session but lock is gone or belongs to someone else, clear them out
    if already_has_session:
        lock = get_table_lock(table_number)
        if not lock:
            print(f"⚠️ Session exists but table lock is gone — clearing session")
            session.clear()
            session.modified = True
            return render_template('customer/forbidden.html',
                reason="Your session has ended. Thank you for dining with us!"), 403
        if lock.get("session_id") != existing_session_id:
            print(f"⚠️ Session exists but lock belongs to someone else — clearing session")
            session.clear()
            session.modified = True
            return render_template('customer/forbidden.html',
                reason="Your session has ended. Thank you for dining with us!"), 403

    if not already_has_session:
        token = request.args.get('token')
        print(f"token from URL: {token}")

        valid, reason = validate_token(token, table_number)
        print(f"validate_token result: valid={valid}, reason={reason}")

        if not valid:
            print(f"❌ BLOCKED at token validation: {reason}")
            return render_template('customer/forbidden.html', reason=reason), 403

        lock = get_table_lock(table_number)
        print(f"table lock: {lock}")

        if lock:
            locked_session = lock.get("session_id", "")
            locked_token = lock.get("token", "")
            current_token = token or ""

            print(f"locked_session: {locked_session}")
            print(f"existing_session_id: {existing_session_id}")
            print(f"sessions match: {locked_session == existing_session_id}")

            if locked_session:
                if existing_session_id == locked_session:
                    print(f"✅ Same session — allowed")
                elif locked_token and current_token and locked_token == current_token and not existing_session_id:
                    # Check device fingerprint stored in lock
                    locked_fp = lock.get("fingerprint", "")
                    # Build current fingerprint from stable headers
                    current_fp = f"{request.headers.get('Accept-Language', '')}"
                    
                    if locked_fp and current_fp and locked_fp != current_fp:
                        print(f"❌ BLOCKED: different device fingerprint")
                        return render_template(
                            'customer/forbidden.html',
                            reason="Table is currently occupied — please wait."
                        ), 403
                    print(f"✅ Restoring session from lock: {locked_session}")
                    session['session_id'] = locked_session
                    session['table_no'] = table_number
                    session['token_verified'] = True
                    session.modified = True
                else:
                    print(f"❌ BLOCKED: table occupied")
                    return render_template(
                        'customer/forbidden.html',
                        reason="Table is currently occupied — please wait."
                    ), 403

        session['token_verified'] = True
        session.modified = True
        print(f"✅ ACCESS GRANTED")

    form = CustomerEntryForm()

    if request.method == 'GET':
        existing_session = session.get('session_id')
        existing_table_now = session.get('table_no')

        if not existing_session or existing_table_now != table_number:
            lock = get_table_lock(table_number)
            print(f"GET — lock for session restore: {lock}")
            if lock and lock.get("session_id"):
                session_id = lock.get("session_id")
                session['session_id'] = session_id
                print(f"GET — restored session_id: {session_id}")
            else:
                session_id = create_customer_session(table_no=table_number)
                session['session_id'] = session_id
                print(f"GET — created new session_id: {session_id}")
        else:
            session_id = existing_session
            print(f"GET — using existing session_id: {session_id}")

        session['table_no'] = table_number
        session['token_verified'] = True
        session.modified = True

        lock_table(
            table_number,
            session['session_id'],
            token=request.args.get('token'),
            user_agent=request.headers.get('User-Agent', ''),
            fingerprint=request.headers.get('Accept-Language', '')
        )
        print(f"GET — table {table_number} locked to session {session['session_id']}")

        customer_data = get_customer_session(session['session_id'])
        print(f"GET — customer_data from Redis: {customer_data}")

        if customer_data and customer_data.get("customer_name") and customer_data["customer_name"] != "Walk-in":
            print(f"GET — customer already identified, skipping to explore")
            ctx = session.get('order_ctx', {})
            if not ctx.get('customer', {}).get('name'):
                ctx.update({
                    "table_no": table_number,
                    "customer": {
                        "name": customer_data["customer_name"],
                        "guests": customer_data.get("guest_count", 1),
                        "table_no": table_number
                    },
                    "state": "IDENTIFIED"
                })
                session['order_ctx'] = ctx
                session.modified = True
            return redirect(url_for('customer_menu.explore_menu'))

        print(f"GET — showing greeting form")
        print(f"{'='*50}\n")
        return render_template(
            'customer/menu.html',
            table_number=table_number,
            form=form,
            session_id=session.get('session_id')
        )

    # POST handler
    if form.validate_on_submit():
        session_id = session.get('session_id')
        print(f"POST — form submitted, session_id: {session_id}")

        if session_id:
            update_customer_session(
                session_id,
                customer_name=form.customer_name.data.strip(),
                guest_count=form.guest_count.data
            )

        ctx = session.get('order_ctx', {})
        ctx.update({
            "table_no": table_number,
            "customer": {
                "name": form.customer_name.data.strip(),
                "guests": form.guest_count.data,
                "table_no": table_number
            },
            "state": "IDENTIFIED"
        })
        session['order_ctx'] = ctx
        session.modified = True
        print(f"POST — redirecting to explore menu")
        print(f"{'='*50}\n")
        return redirect(url_for('customer_menu.explore_menu'))

    print(f"POST — form validation failed, showing form again")
    print(f"{'='*50}\n")
    return render_template(
        'customer/menu.html',
        table_number=table_number,
        form=form,
        session_id=session.get('session_id')
    )

@greeting.route('/invalid-table')
def invalid():
    return render_template('customer/forbidden.html', reason="Invalid table — please scan a valid QR code."), 403


@greeting.route('/session/<string:session_id>')
def claim_session(session_id):
    return render_template('customer/forbidden.html', reason="Please scan the QR code to access this page."), 403