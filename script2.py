import urllib.request
url = "https://raw.githubusercontent.com/supabase/auth/master/README.md"
req = urllib.request.urlopen(url)
text = req.read().decode('utf-8')
for line in text.split('\n'):
    if "OIDC" in line or "CUSTOM" in line or "GOTRUE_EXTERNAL" in line:
        print(line)
