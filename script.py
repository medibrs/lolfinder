import urllib.request
import json
url = "https://raw.githubusercontent.com/supabase/auth/master/README.md"
req = urllib.request.urlopen(url)
text = req.read().decode('utf-8')
lines = text.split('\n')
for i, line in enumerate(lines):
    if line.startswith("GOTRUE_EXTERNAL_") and "URL" in line or "AUTH" in line or "CUSTOM" in line or "OIDC" in line:
        print(line)
