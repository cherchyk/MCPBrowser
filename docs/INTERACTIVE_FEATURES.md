# Interactive Features Guide

MCPBrowser now supports **human-like interaction** with web pages! This guide explains how to use the new interactive capabilities.

## Overview

The new interactive features allow you to:
- ✅ Click on any element (buttons, links, divs with onclick handlers, etc.)
- ✅ Type text into input fields with human-like delays
- ✅ Discover all interactive elements on a page
- ✅ Wait for elements to appear (useful for dynamic content)

## Prerequisites

Before interacting with a page, you **must first load it** using `fetch_webpage_protected`:

```javascript
fetch_webpage_protected({ url: "https://example.com" })
```

All interactive operations work on already-loaded pages and reuse the same browser tab.

## Available Tools

### 1. `click_element` - Click on page elements

Click on any clickable element using either a CSS selector or text content.

**Parameters:**
- `url` (required): URL of the page (must match a previously loaded page)
- `selector` (optional): CSS selector for the element (e.g., `#submit-btn`, `.login-button`)
- `text` (optional): Text content to search for if selector not provided
- `timeout` (optional): Maximum wait time in milliseconds (default: 30000)

**Examples:**

```javascript
// Click by CSS selector
click_element({
  url: "https://example.com",
  selector: "#login-button"
})

// Click by text content
click_element({
  url: "https://example.com",
  text: "Sign In"
})

// Click with custom timeout
click_element({
  url: "https://example.com",
  text: "Submit",
  timeout: 5000
})
```

**Key Features:**
- Works with ANY clickable element (not just `<a>` tags)
- Automatically scrolls element into view before clicking
- Smart text matching - finds the most specific match
- Returns the current URL after clicking (to detect navigation)

---

### 2. `type_text` - Type into input fields

Type text into input fields, textareas, or any editable element with human-like typing simulation.

**Parameters:**
- `url` (required): URL of the page
- `selector` (required): CSS selector for the input element
- `text` (required): Text to type
- `clear` (optional): Clear existing text first (default: true)
- `delay` (optional): Delay between keystrokes in ms (default: 50)
- `timeout` (optional): Maximum wait time in milliseconds (default: 30000)

**Examples:**

```javascript
// Type username
type_text({
  url: "https://example.com",
  selector: "#username",
  text: "myuser@example.com"
})

// Type password without clearing
type_text({
  url: "https://example.com",
  selector: "#password",
  text: "mypassword123",
  clear: false
})

// Fast typing (no delay)
type_text({
  url: "https://example.com",
  selector: "#search",
  text: "search query",
  delay: 0
})
```

**Key Features:**
- Human-like typing with customizable delays
- Option to clear existing text or append
- Works with input, textarea, and contenteditable elements

---

### 3. `get_interactive_elements` - List all interactive elements

Discover all interactive elements on the page including links, buttons, inputs, and elements with onclick handlers.

**Parameters:**
- `url` (required): URL of the page
- `limit` (optional): Maximum number of elements to return (default: 50)

**Returns:** Array of elements with details:
- `tag`: HTML tag name
- `text`: Visible text content (first 100 chars)
- `selector`: Suggested CSS selector
- `href`: Link URL (if applicable)
- `type`: Input type (if applicable)
- `name`: Element name attribute
- `id`: Element ID
- `hasOnClick`: Whether element has onclick handler
- `role`: ARIA role

**Example:**

```javascript
get_interactive_elements({
  url: "https://example.com",
  limit: 20
})
```

**Response:**
```json
{
  "success": true,
  "count": 5,
  "elements": [
    {
      "tag": "button",
      "text": "Sign In",
      "selector": "button#login-btn",
      "href": null,
      "type": "submit",
      "name": "login",
      "id": "login-btn",
      "hasOnClick": false,
      "role": null
    },
    {
      "tag": "a",
      "text": "Forgot Password?",
      "selector": "a.forgot-link",
      "href": "https://example.com/forgot",
      "type": null,
      "name": null,
      "id": null,
      "hasOnClick": false,
      "role": null
    }
  ]
}
```

**Use Cases:**
- Discover what's clickable on a page
- Find the right selector for clicking
- Understand page structure before interacting

---

### 4. `wait_for_element` - Wait for element to appear

Wait for an element to appear on the page. Useful after clicking something that triggers dynamic content loading.

**Parameters:**
- `url` (required): URL of the page
- `selector` (optional): CSS selector to wait for
- `text` (optional): Text content to wait for if selector not provided
- `timeout` (optional): Maximum wait time in milliseconds (default: 30000)

**Examples:**

```javascript
// Wait for success message by selector
wait_for_element({
  url: "https://example.com",
  selector: ".success-message"
})

// Wait for text to appear
wait_for_element({
  url: "https://example.com",
  text: "Welcome back!"
})

// Custom timeout
wait_for_element({
  url: "https://example.com",
  selector: "#result",
  timeout: 10000
})
```

**Use Cases:**
- Wait for loading indicators to disappear
- Wait for success/error messages
- Wait for dynamic content to load after clicking

---

## Complete Workflow Examples

### Example 1: Login to a website

```javascript
// Step 1: Load the login page
fetch_webpage_protected({ url: "https://example.com/login" })

// Step 2: Fill in credentials
type_text({ 
  url: "https://example.com/login", 
  selector: "#username", 
  text: "user@example.com" 
})

type_text({ 
  url: "https://example.com/login", 
  selector: "#password", 
  text: "mypassword" 
})

// Step 3: Click login button
click_element({ 
  url: "https://example.com/login", 
  text: "Sign In" 
})

// Step 4: Wait for dashboard to load
wait_for_element({ 
  url: "https://example.com/login", 
  selector: ".dashboard" 
})
```

### Example 2: Search and filter

```javascript
// Step 1: Load the page
fetch_webpage_protected({ url: "https://shop.example.com" })

// Step 2: Discover search elements
get_interactive_elements({ 
  url: "https://shop.example.com", 
  limit: 20 
})

// Step 3: Type in search box
type_text({ 
  url: "https://shop.example.com", 
  selector: "#search-input", 
  text: "laptop" 
})

// Step 4: Click search button
click_element({ 
  url: "https://shop.example.com", 
  selector: "#search-button" 
})

// Step 5: Wait for results
wait_for_element({ 
  url: "https://shop.example.com", 
  selector: ".search-results" 
})

// Step 6: Click on a filter
click_element({ 
  url: "https://shop.example.com", 
  text: "Price: Low to High" 
})
```

### Example 3: Fill out a form

```javascript
// Step 1: Load the form
fetch_webpage_protected({ url: "https://example.com/contact" })

// Step 2: Fill all fields
type_text({ 
  url: "https://example.com/contact", 
  selector: "#name", 
  text: "John Doe" 
})

type_text({ 
  url: "https://example.com/contact", 
  selector: "#email", 
  text: "john@example.com" 
})

type_text({ 
  url: "https://example.com/contact", 
  selector: "#message", 
  text: "Hello, I have a question..." 
})

// Step 3: Submit
click_element({ 
  url: "https://example.com/contact", 
  selector: "button[type='submit']" 
})

// Step 4: Wait for confirmation
wait_for_element({ 
  url: "https://example.com/contact", 
  text: "Thank you for contacting us" 
})
```

---

## Tips and Best Practices

### 1. Always load the page first
```javascript
// ❌ Wrong - will fail
click_element({ url: "https://example.com", selector: "#btn" })

// ✅ Correct
fetch_webpage_protected({ url: "https://example.com" })
click_element({ url: "https://example.com", selector: "#btn" })
```

### 2. Use text-based selection when selector is unknown
```javascript
// When you don't know the exact selector
click_element({ url: "https://example.com", text: "Continue" })
```

### 3. Discover elements before interacting
```javascript
// Find out what's on the page first
get_interactive_elements({ url: "https://example.com" })
// Then use the selector from the results
click_element({ url: "https://example.com", selector: "#found-selector" })
```

### 4. Wait for dynamic content
```javascript
// After clicking, wait for results to appear
click_element({ url: "https://example.com", text: "Load More" })
wait_for_element({ url: "https://example.com", selector: ".new-content" })
```

### 5. Use human-like typing for anti-bot detection
```javascript
// Slower typing appears more human-like
type_text({ 
  url: "https://example.com", 
  selector: "#input", 
  text: "text",
  delay: 100  // 100ms between keystrokes
})
```

---

## Error Handling

All tools return a result object with `success` field:

**Success:**
```json
{
  "success": true,
  "message": "Clicked element: #submit-btn",
  "currentUrl": "https://example.com/success"
}
```

**Error:**
```json
{
  "success": false,
  "error": "Element not found: #missing-element"
}
```

**Common Errors:**
- `"url parameter is required"` - You forgot to specify the URL
- `"No open page found for {hostname}"` - You need to fetch the page first
- `"Element not found"` - The selector or text doesn't match any element
- `"Failed to click element: timeout"` - Element didn't appear within timeout

---

## Session Management

All interactions happen in the **same browser tab** for the same domain:

```javascript
// Opens gmail.com in a new tab
fetch_webpage_protected({ url: "https://gmail.com/mail" })

// Reuses the same tab
click_element({ url: "https://gmail.com/mail", text: "Compose" })
type_text({ url: "https://gmail.com/mail", selector: "#to", text: "test@example.com" })

// Opens example.com in a NEW tab (different domain)
fetch_webpage_protected({ url: "https://example.com" })
```

This preserves:
- ✅ Authentication sessions
- ✅ Cookies
- ✅ Page state
- ✅ Scroll position

---

## Limitations

1. **Page must be loaded first** - Can't interact with pages that haven't been fetched
2. **URL must match exactly** - Use the same URL you used with `fetch_webpage_protected`
3. **Element must be visible** - Hidden elements (display:none) can't be clicked
4. **No iframe support** - Can only interact with main page content
5. **Single tab per domain** - Multiple windows of same domain share one tab

---

## Testing

Run the interactive tests:

```bash
cd MCPBrowser
npm test -- interactive.test.js
```

The tests verify:
- ✅ Parameter validation
- ✅ Error handling
- ✅ Page state checks
- ✅ Real browser integration

---

## Support

For issues or questions:
- GitHub Issues: https://github.com/cherchyk/MCPBrowser/issues
- Documentation: https://github.com/cherchyk/MCPBrowser

---

**Happy automating!** 🎯
