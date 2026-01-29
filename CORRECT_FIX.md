# ✅ CORRECT FIX COMMAND

## The app data is stored in: `Interview AI` (with a space)

---

## 🚨 FOLLOW THESE STEPS:

### STEP 1: Close the App
Press **Ctrl+C** in the terminal where the app is running.

### STEP 2: Clear App Data
Copy and paste this command in PowerShell:

```powershell
Remove-Item -Recurse -Force "$env:APPDATA\Interview AI" -ErrorAction SilentlyContinue
```

### STEP 3: Start the App
```bash
npm start
```

### STEP 4: Enter OpenAI API Key
When the app asks for API key, paste this:

```
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
```

---

## ⚡ ONE-LINE FIX (All in one):

```powershell
Remove-Item -Recurse -Force "$env:APPDATA\Interview AI" -ErrorAction SilentlyContinue; npm start
```

Then paste your OpenAI key when prompted.

---

## 📍 App Data Location:

```
C:\Users\YOUR_USERNAME\AppData\Roaming\Interview AI
```

This folder contains the old Gemini API key. We need to delete it!

---

## ✅ After This Fix:

You should see:
```
✅ OpenAI session initialized successfully
✅ Session connected
```

No more 401 errors!

---

**Copy the command above and run it now!** 🚀
