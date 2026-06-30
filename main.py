from src.__init__ import createapp

app = createapp()

if __name__ == '__main__':
    # Listen on all network interfaces (0.0.0.0) so phone can access via WiFi
    app.run(host='0.0.0.0', port=5000, debug=True, use_reloader=False)