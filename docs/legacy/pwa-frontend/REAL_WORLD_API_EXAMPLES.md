# Real-World Working API Examples

This document provides **actual working APIs** you can use to test the API Integration feature. All examples use real endpoints that you can test immediately.

---

## Example 1: JSONPlaceholder (No Authentication) ✅ WORKS NOW

**Real Public API** - Perfect for testing without any setup

### Form Fields:

- **Source Name**: `JSONPlaceholder Posts API`
- **Source Type**: `Custom`
- **API Endpoint URL**: `https://jsonplaceholder.typicode.com/posts`
- **HTTP Method**: `GET`
- **Authentication Type**: `None`
- **Custom Headers**: (leave empty or use):
  ```json
  {
    "Accept": "application/json"
  }
  ```
- **Request Body**: (leave empty)

**Test This**: This endpoint returns a list of blog posts. Works immediately!

---

## Example 2: JSONPlaceholder - Get Single Post ✅ WORKS NOW

### Form Fields:

- **Source Name**: `JSONPlaceholder Single Post`
- **Source Type**: `Custom`
- **API Endpoint URL**: `https://jsonplaceholder.typicode.com/posts/1`
- **HTTP Method**: `GET`
- **Authentication Type**: `None`
- **Custom Headers**: (leave empty)
- **Request Body**: (leave empty)

**Test This**: Returns post with ID 1.

---

## Example 3: JSONPlaceholder - Create Post (POST) ✅ WORKS NOW

### Form Fields:

- **Source Name**: `JSONPlaceholder Create Post`
- **Source Type**: `Custom`
- **API Endpoint URL**: `https://jsonplaceholder.typicode.com/posts`
- **HTTP Method**: `POST`
- **Authentication Type**: `None`
- **Custom Headers**:
  ```json
  {
    "Content-Type": "application/json"
  }
  ```
- **Request Body**:
  ```json
  {
    "title": "Test Post from Brewra",
    "body": "This is a test post created via API integration",
    "userId": 1
  }
  ```

**Test This**: Creates a new post (simulated - returns created object).

---

## Example 4: HTTPBin - Test GET Request ✅ WORKS NOW

**Real Public API** for testing HTTP requests

### Form Fields:

- **Source Name**: `HTTPBin GET Test`
- **Source Type**: `Custom`
- **API Endpoint URL**: `https://httpbin.org/get`
- **HTTP Method**: `GET`
- **Authentication Type**: `None`
- **Custom Headers**:
  ```json
  {
    "X-Test-Header": "Brewra-Integration",
    "Accept": "application/json"
  }
  ```
- **Request Body**: (leave empty)

**Test This**: Returns your request details including headers.

---

## Example 5: HTTPBin - Test POST Request ✅ WORKS NOW

### Form Fields:

- **Source Name**: `HTTPBin POST Test`
- **Source Type**: `Custom`
- **API Endpoint URL**: `https://httpbin.org/post`
- **HTTP Method**: `POST`
- **Authentication Type**: `None`
- **Custom Headers**:
  ```json
  {
    "Content-Type": "application/json"
  }
  ```
- **Request Body**:
  ```json
  {
    "message": "Hello from Brewra",
    "timestamp": "2024-01-15T10:30:00Z",
    "source": "API Integration Test"
  }
  ```

**Test This**: Returns your POST data.

---

## Example 6: REST Countries API ✅ WORKS NOW

**Real Public API** - Get country information

### Form Fields:

- **Source Name**: `REST Countries API`
- **Source Type**: `Custom`
- **API Endpoint URL**: `https://restcountries.com/v3.1/name/usa`
- **HTTP Method**: `GET`
- **Authentication Type**: `None`
- **Custom Headers**:
  ```json
  {
    "Accept": "application/json"
  }
  ```
- **Request Body**: (leave empty)

**Test This**: Returns information about USA. Try other countries: `france`, `japan`, `india`

---

## Example 7: Dog API (Random Dog Image) ✅ WORKS NOW

**Real Public API** - Get random dog images

### Form Fields:

- **Source Name**: `Dog API Random`
- **Source Type**: `Custom`
- **API Endpoint URL**: `https://dog.ceo/api/breeds/image/random`
- **HTTP Method**: `GET`
- **Authentication Type**: `None`
- **Custom Headers**: (leave empty)
- **Request Body**: (leave empty)

**Test This**: Returns a random dog image URL.

---

## Example 8: Cat Facts API ✅ WORKS NOW

**Real Public API** - Get random cat facts

### Form Fields:

- **Source Name**: `Cat Facts API`
- **Source Type**: `Custom`
- **API Endpoint URL**: `https://catfact.ninja/fact`
- **HTTP Method**: `GET`
- **Authentication Type**: `None`
- **Custom Headers**: (leave empty)
- **Request Body**: (leave empty)

**Test This**: Returns a random cat fact.

---

## Example 9: IPify - Get Public IP ✅ WORKS NOW

**Real Public API** - Get your public IP address

### Form Fields:

- **Source Name**: `IPify Public IP`
- **Source Type**: `Custom`
- **API Endpoint URL**: `https://api.ipify.org?format=json`
- **HTTP Method**: `GET`
- **Authentication Type**: `None`
- **Custom Headers**: (leave empty)
- **Request Body**: (leave empty)

**Test This**: Returns your public IP address in JSON format.

---

## Example 10: OpenWeatherMap (Requires Free API Key) 🌤️

**Real Weather API** - Requires free API key from openweathermap.org

### How to Get API Key:

1. Go to https://openweathermap.org/api
2. Sign up for free account
3. Get your API key from dashboard

### Form Fields:

- **Source Name**: `OpenWeatherMap API`
- **Source Type**: `Analytics`
- **API Endpoint URL**: `https://api.openweathermap.org/data/2.5/weather?q=London&appid=YOUR_API_KEY_HERE`
- **HTTP Method**: `GET`
- **Authentication Type**: `None` (API key in URL)
- **Custom Headers**: (leave empty)
- **Request Body**: (leave empty)

**Note**: Replace `YOUR_API_KEY_HERE` with your actual API key.

---

## Example 11: NewsAPI (Requires Free API Key) 📰

**Real News API** - Requires free API key from newsapi.org

### How to Get API Key:

1. Go to https://newsapi.org/
2. Sign up for free account
3. Get your API key

### Form Fields:

- **Source Name**: `NewsAPI Headlines`
- **Source Type**: `Custom`
- **API Endpoint URL**: `https://newsapi.org/v2/top-headlines?country=us&apiKey=YOUR_API_KEY_HERE`
- **HTTP Method**: `GET`
- **Authentication Type**: `None` (API key in URL)
- **Custom Headers**: (leave empty)
- **Request Body**: (leave empty)

**Note**: Replace `YOUR_API_KEY_HERE` with your actual API key.

---

## Example 12: GitHub API (Public Repos - No Auth) ✅ WORKS NOW

**Real GitHub API** - Get public repository information

### Form Fields:

- **Source Name**: `GitHub Public API`
- **Source Type**: `Custom`
- **API Endpoint URL**: `https://api.github.com/repos/octocat/Hello-World`
- **HTTP Method**: `GET`
- **Authentication Type**: `None`
- **Custom Headers**:
  ```json
  {
    "Accept": "application/vnd.github.v3+json",
    "User-Agent": "Brewra-Integration"
  }
  ```
- **Request Body**: (leave empty)

**Test This**: Returns information about the Hello-World repository.

**Try Other Endpoints**:

- `https://api.github.com/users/octocat` - Get user info
- `https://api.github.com/zen` - Get random quote
- `https://api.github.com/emojis` - Get emoji list

---

## Example 13: GitHub API (With Personal Access Token) 🔑

**Real GitHub API** - Requires Personal Access Token for authenticated requests

### How to Get Token:

1. Go to GitHub → Settings → Developer settings → Personal access tokens
2. Generate new token with `public_repo` scope
3. Copy the token (starts with `ghp_`)

### Form Fields:

- **Source Name**: `GitHub Authenticated API`
- **Source Type**: `Custom`
- **API Endpoint URL**: `https://api.github.com/user`
- **HTTP Method**: `GET`
- **Authentication Type**: `Bearer Token`
- **Bearer Token**: `ghp_your_personal_access_token_here`
- **Custom Headers**:
  ```json
  {
    "Accept": "application/vnd.github.v3+json",
    "User-Agent": "Brewra-Integration"
  }
  ```
- **Request Body**: (leave empty)

**Note**: Replace `ghp_your_personal_access_token_here` with your actual token.

---

## Example 14: JSONPlaceholder - Update Post (PUT) ✅ WORKS NOW

### Form Fields:

- **Source Name**: `JSONPlaceholder Update Post`
- **Source Type**: `Custom`
- **API Endpoint URL**: `https://jsonplaceholder.typicode.com/posts/1`
- **HTTP Method**: `PUT`
- **Authentication Type**: `None`
- **Custom Headers**:
  ```json
  {
    "Content-Type": "application/json"
  }
  ```
- **Request Body**:
  ```json
  {
    "id": 1,
    "title": "Updated Post Title",
    "body": "This post has been updated via API",
    "userId": 1
  }
  ```

**Test This**: Simulates updating post with ID 1.

---

## Example 15: JSONPlaceholder - Patch Post (PATCH) ✅ WORKS NOW

### Form Fields:

- **Source Name**: `JSONPlaceholder Patch Post`
- **Source Type**: `Custom`
- **API Endpoint URL**: `https://jsonplaceholder.typicode.com/posts/1`
- **HTTP Method**: `PATCH`
- **Authentication Type**: `None`
- **Custom Headers**:
  ```json
  {
    "Content-Type": "application/json"
  }
  ```
- **Request Body**:
  ```json
  {
    "title": "Partially Updated Title"
  }
  ```

**Test This**: Simulates partial update of post.

---

## Example 16: CoinGecko API (Free, No Auth) ✅ WORKS NOW

**Real Cryptocurrency API** - Get crypto prices

### Form Fields:

- **Source Name**: `CoinGecko Bitcoin Price`
- **Source Type**: `Analytics`
- **API Endpoint URL**: `https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd`
- **HTTP Method**: `GET`
- **Authentication Type**: `None`
- **Custom Headers**:
  ```json
  {
    "Accept": "application/json"
  }
  ```
- **Request Body**: (leave empty)

**Test This**: Returns Bitcoin price in USD.

**Try Other Coins**:

- Change `ids=bitcoin` to `ids=ethereum` for Ethereum
- Change `ids=bitcoin` to `ids=dogecoin` for Dogecoin

---

## Example 17: Random User API ✅ WORKS NOW

**Real Public API** - Get random user data

### Form Fields:

- **Source Name**: `Random User Generator`
- **Source Type**: `Custom`
- **API Endpoint URL**: `https://randomuser.me/api/`
- **HTTP Method**: `GET`
- **Authentication Type**: `None`
- **Custom Headers**: (leave empty)
- **Request Body**: (leave empty)

**Test This**: Returns random user data (name, email, location, etc.)

---

## Example 18: Quote API ✅ WORKS NOW

**Real Public API** - Get random quotes

### Form Fields:

- **Source Name**: `Quote API`
- **Source Type**: `Custom`
- **API Endpoint URL**: `https://api.quotable.io/random`
- **HTTP Method**: `GET`
- **Authentication Type**: `None`
- **Custom Headers**: (leave empty)
- **Request Body**: (leave empty)

**Test This**: Returns a random quote.

---

## Example 19: Joke API ✅ WORKS NOW

**Real Public API** - Get random jokes

### Form Fields:

- **Source Name**: `Joke API`
- **Source Type**: `Custom`
- **API Endpoint URL**: `https://official-joke-api.appspot.com/random_joke`
- **HTTP Method**: `GET`
- **Authentication Type**: `None`
- **Custom Headers**: (leave empty)
- **Request Body**: (leave empty)

**Test This**: Returns a random joke.

---

## Example 20: OAuth2 Example (Stripe API - Requires API Key)

**Real Payment API** - Stripe uses API keys (not OAuth2 in this flow, but similar pattern)

### How to Get API Key:

1. Go to https://stripe.com/
2. Sign up for account
3. Get API keys from dashboard

### Form Fields (Using API Key as Bearer):

- **Source Name**: `Stripe API`
- **Source Type**: `Custom`
- **API Endpoint URL**: `https://api.stripe.com/v1/charges`
- **HTTP Method**: `GET`
- **Authentication Type**: `Bearer Token`
- **Bearer Token**: `sk_test_your_stripe_secret_key_here`
- **Custom Headers**:
  ```json
  {
    "Accept": "application/json"
  }
  ```
- **Request Body**: (leave empty)

**Note**: Replace with your Stripe test secret key (starts with `sk_test_`)

---

## Quick Start: Test These APIs Right Now (No Setup Required)

### 1. JSONPlaceholder Posts

```
Endpoint: https://jsonplaceholder.typicode.com/posts
Method: GET
Auth: None
```

### 2. HTTPBin GET

```
Endpoint: https://httpbin.org/get
Method: GET
Auth: None
```

### 3. REST Countries

```
Endpoint: https://restcountries.com/v3.1/name/usa
Method: GET
Auth: None
```

### 4. Dog API

```
Endpoint: https://dog.ceo/api/breeds/image/random
Method: GET
Auth: None
```

### 5. Cat Facts

```
Endpoint: https://catfact.ninja/fact
Method: GET
Auth: None
```

### 6. GitHub Public

```
Endpoint: https://api.github.com/zen
Method: GET
Auth: None
```

### 7. Random User

```
Endpoint: https://randomuser.me/api/
Method: GET
Auth: None
```

### 8. Quote API

```
Endpoint: https://api.quotable.io/random
Method: GET
Auth: None
```

---

## Testing Tips

1. **Start with No Auth APIs**: Use examples 1-9 to test basic functionality
2. **Test Different Methods**: Try GET, POST, PUT, PATCH
3. **Validate JSON**: Make sure headers and body are valid JSON
4. **Check Responses**: In demo mode, you'll see validation messages
5. **Real APIs Work**: All "✅ WORKS NOW" examples are real APIs you can test

---

## Notes

- **✅ WORKS NOW**: These APIs work immediately without any setup
- **🔑 Requires Key**: These APIs need free API keys (sign up required)
- **Demo Mode**: Currently in demo mode, so actual API calls aren't made, but validation works
- **Production**: When backend is integrated, these will make real API calls
- **Rate Limits**: Some free APIs have rate limits - check their documentation

---

## API Documentation Links

- **JSONPlaceholder**: https://jsonplaceholder.typicode.com/
- **HTTPBin**: https://httpbin.org/
- **REST Countries**: https://restcountries.com/
- **Dog API**: https://dog.ceo/api/
- **GitHub API**: https://docs.github.com/en/rest
- **CoinGecko**: https://www.coingecko.com/en/api
- **Random User**: https://randomuser.me/documentation
- **Quote API**: https://github.com/lukePeavey/quotable

---

## Recommended Testing Order

1. **First**: JSONPlaceholder GET (Example 1) - Simplest test
2. **Second**: HTTPBin GET (Example 4) - See your request details
3. **Third**: JSONPlaceholder POST (Example 3) - Test POST with body
4. **Fourth**: REST Countries (Example 6) - Real-world data
5. **Fifth**: Try OAuth2 form (Example 4 from previous doc) - See OAuth2 UI

All these APIs are real and working. You can test them in your browser or with tools like Postman to verify they work before using them in the integration form.
