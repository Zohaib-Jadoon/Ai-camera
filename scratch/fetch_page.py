import urllib.request
import urllib.error

def main():
    url = "http://localhost:3000"
    print(f"Fetching {url}...")
    try:
        req = urllib.request.Request(
            url, 
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
        )
        with urllib.request.urlopen(req) as response:
            html = response.read().decode('utf-8')
            print("Status Code:", response.status)
            print("Headers:")
            for k, v in response.headers.items():
                print(f"  {k}: {v}")
            print("\nFirst 1000 characters of HTML:")
            print(html[:1000])
    except urllib.error.URLError as e:
        print("URL Error:", e)
    except Exception as e:
        print("Exception:", e)

if __name__ == "__main__":
    main()
