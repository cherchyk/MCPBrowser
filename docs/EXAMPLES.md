# Quick Start Examples

## Example 1: Simple Click

```javascript
// 1. Load the page
await fetch_webpage({ url: "https://example.com" });

// 2. Click a button
await click_element({ 
  url: "https://example.com", 
  text: "More information" 
});
```

## Example 2: Form Submission

```javascript
// 1. Load login page
await fetch_webpage({ url: "https://myapp.com/login" });

// 2. Fill username
await type_text({ 
  url: "https://myapp.com/login",
  selector: "#username",
  text: "myusername"
});

// 3. Fill password
await type_text({ 
  url: "https://myapp.com/login",
  selector: "#password",
  text: "mypassword"
});

// 4. Click login
await click_element({ 
  url: "https://myapp.com/login",
  text: "Login"
});

// 5. Wait for dashboard
await wait_for_element({ 
  url: "https://myapp.com/login",
  selector: ".dashboard"
});
```

## Example 3: Discover and Click

```javascript
// 1. Load the page
await fetch_webpage({ url: "https://store.com" });

// 2. Discover all clickable elements
const elements = await get_interactive_elements({ 
  url: "https://store.com",
  limit: 20
});

// 3. Find a specific button from the list
console.log(elements.elements);
// [
//   { tag: "button", text: "Add to Cart", selector: "#add-cart", ... },
//   { tag: "a", text: "View Details", selector: ".product-link", ... },
//   ...
// ]

// 4. Click the button you found
await click_element({ 
  url: "https://store.com",
  selector: "#add-cart"
});
```

## Example 4: Handle Dynamic Content

```javascript
// 1. Load the page
await fetch_webpage({ url: "https://social.com/feed" });

// 2. Click "Load More" button
await click_element({ 
  url: "https://social.com/feed",
  text: "Load More"
});

// 3. Wait for new content to appear
await wait_for_element({ 
  url: "https://social.com/feed",
  selector: ".new-posts",
  timeout: 10000
});

// 4. Interact with new content
await click_element({ 
  url: "https://social.com/feed",
  text: "Like"
});
```

## Example 5: Multi-Step Workflow

```javascript
// Complete workflow: Search -> Filter -> Select

// 1. Load e-commerce site
await fetch_webpage({ url: "https://shop.com" });

// 2. Search for product
await type_text({ 
  url: "https://shop.com",
  selector: "#search-box",
  text: "wireless headphones"
});

await click_element({ 
  url: "https://shop.com",
  selector: "button.search-btn"
});

// 3. Wait for results
await wait_for_element({ 
  url: "https://shop.com",
  selector: ".search-results"
});

// 4. Apply filter
await click_element({ 
  url: "https://shop.com",
  text: "Under $100"
});

// 5. Wait for filtered results
await wait_for_element({ 
  url: "https://shop.com",
  selector: ".filtered-results"
});

// 6. Click on first product
await click_element({ 
  url: "https://shop.com",
  selector: ".product-card:first-child"
});
```

## Example 6: Click Elements with onclick Handlers

```javascript
// Many modern websites use divs/spans with onclick instead of <a> tags

// 1. Load the page
await fetch_webpage({ url: "https://webapp.com/dashboard" });

// 2. Discover elements with onclick handlers
const elements = await get_interactive_elements({ 
  url: "https://webapp.com/dashboard"
});

// Look for elements with hasOnClick: true
// { tag: "div", text: "Settings", hasOnClick: true, ... }

// 3. Click by text (works even if it's not a link!)
await click_element({ 
  url: "https://webapp.com/dashboard",
  text: "Settings"
});
```

## Tips

### Use text-based clicking when structure changes
```javascript
// ✅ Good - resilient to page changes
await click_element({ url: "https://example.com", text: "Submit" });

// ❌ Fragile - breaks if class names change
await click_element({ url: "https://example.com", selector: ".btn-primary-lg-submit-v2" });
```

### Chain operations for complex workflows
```javascript
async function loginAndNavigate() {
  // Load
  await fetch_webpage({ url: "https://app.com/login" });
  
  // Login
  await type_text({ url: "https://app.com/login", selector: "#user", text: "me" });
  await type_text({ url: "https://app.com/login", selector: "#pass", text: "secret" });
  await click_element({ url: "https://app.com/login", text: "Sign In" });
  
  // Navigate
  await wait_for_element({ url: "https://app.com/login", selector: ".dashboard" });
  await click_element({ url: "https://app.com/login", text: "Reports" });
  await wait_for_element({ url: "https://app.com/login", selector: ".reports-page" });
}
```

### Error handling
```javascript
const result = await click_element({ 
  url: "https://example.com", 
  text: "Submit" 
});

if (!result.success) {
  console.error("Click failed:", result.error);
  // Try alternative approach
  await click_element({ 
    url: "https://example.com", 
    selector: "#submit-btn" 
  });
}
```
