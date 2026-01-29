# 📸 How to Enable Manual Screenshot Mode (Ctrl+Enter Only)

## ✅ Your App Already Supports Manual Mode!

The app has a built-in "Manual" screenshot mode where screenshots are ONLY taken when you press **Ctrl+Enter** (or **Cmd+Enter** on Mac).

---

## 🎯 How to Enable Manual Mode:

### **In the App:**

1. **Go to Settings/Customize** (gear icon ⚙️)
2. **Find "Screenshot Interval"** dropdown
3. **Select "Manual"** from the options
4. **Save settings**

Now screenshots will ONLY be taken when you press **Ctrl+Enter**!

---

## 🔧 Alternative: Set Manual Mode as Default

If you want manual mode to be the default every time you start the app:

**Edit:** `src/components/app/InterviewCrackerApp.js`

**Line 206** - Change:
```javascript
this.selectedScreenshotInterval = localStorage.getItem('selectedScreenshotInterval') || '5';
```

**To:**
```javascript
this.selectedScreenshotInterval = localStorage.getItem('selectedScreenshotInterval') || 'manual';
```

Then restart the app.

---

## ⌨️ Keyboard Shortcuts:

| Shortcut | Action |
|----------|--------|
| **Ctrl+Enter** (Windows/Linux) | Take screenshot & analyze |
| **Cmd+Enter** (Mac) | Take screenshot & analyze |

---

## 📊 Screenshot Interval Options:

| Option | Behavior |
|--------|----------|
| **Manual** | Only on Ctrl+Enter press ✅ |
| **2 seconds** | Auto-capture every 2 seconds |
| **5 seconds** | Auto-capture every 5 seconds |
| **10 seconds** | Auto-capture every 10 seconds |

---

## 💡 How Manual Mode Works:

1. **Start interview session** (no automatic screenshots)
2. **Press Ctrl+Enter** when you see a question
3. **AI analyzes the screenshot** and provides answer
4. **Repeat** for each question

---

## ✅ Benefits of Manual Mode:

- ✅ **Save tokens** - Only analyze when needed
- ✅ **Save money** - Fewer API calls
- ✅ **More control** - You decide when to capture
- ✅ **Better accuracy** - Capture exactly when question appears

---

## 🚀 Quick Setup:

1. Open the app
2. Click ⚙️ Settings
3. Change "Screenshot Interval" to "Manual"
4. Start interview
5. Press Ctrl+Enter when you need help

---

**Manual mode is perfect for saving costs and having full control over when screenshots are taken!** 🎯
