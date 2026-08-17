# Skill: playwright-cli Reference

This skill teaches you how to use `playwright-cli` for browser automation.
It is a token-efficient CLI tool built for AI coding agents. It saves page
data to disk instead of flooding the context window.

---

## Core Concept

Every command outputs a compact page state summary after execution:
```
### Page
- Page URL: https://app.com/dashboard
- Page Title: Dashboard
### Snapshot
[Snapshot](.playwright-cli/page-2026-04-08T08-00-00-000Z.yml)
```

Always read the snapshot file to understand what is on the page before deciding your next action.

---

## Essential Commands

### Open & Navigate
```bash
playwright-cli open <url>          # open browser and go to url
playwright-cli goto <url>          # navigate to a new url (browser already open)
playwright-cli go-back             # browser back
playwright-cli go-forward          # browser forward
playwright-cli reload              # reload current page
```

### Read the Page
```bash
playwright-cli snapshot            # capture page structure → saves as .yml file
playwright-cli snapshot --filename=my-snapshot.yml   # save to specific file
playwright-cli screenshot          # screenshot of full page
playwright-cli screenshot --filename=my-shot.png     # save to specific file
```

### Interact with Elements
```bash
playwright-cli click <ref>         # click element by ref from snapshot (e.g. e15)
playwright-cli click "role=button[name=Submit]"      # click by role selector
playwright-cli click "#login-btn"  # click by CSS selector
playwright-cli fill <ref> <text>   # fill an input field
playwright-cli type <text>         # type into currently focused element
playwright-cli select <ref> <val>  # select dropdown option
playwright-cli check <ref>         # check a checkbox
playwright-cli uncheck <ref>       # uncheck a checkbox
playwright-cli hover <ref>         # hover over element
```

### Element Refs
Refs (e.g. `e15`, `e21`) come from snapshot files. Always snapshot first,
read the file, find the ref for the element you want, then use it.

### Session Management
```bash
playwright-cli state-save <file>   # save cookies + localStorage to file
playwright-cli state-load <file>   # restore saved session state

# Named sessions (for parallel crawling)
playwright-cli -s=session1 open <url>   # open in named session
playwright-cli -s=session2 open <url>   # open separate session in parallel
playwright-cli list                      # list all active sessions
playwright-cli close-all                 # close all sessions
```

### DevTools
```bash
playwright-cli console             # read browser console messages
playwright-cli eval <js>           # evaluate JavaScript on the page
playwright-cli network             # list network requests since page load
```

### Browser Options
```bash
playwright-cli open <url> --headed          # show browser window (visible mode)
playwright-cli open <url> --browser=firefox # use firefox instead of chromium
playwright-cli open <url> --browser=webkit  # use webkit
playwright-cli open <url> --persistent      # persist profile to disk
```

---

## Reading Snapshot Files

Snapshots are YAML files containing the accessibility tree of the page.
They list every visible element with its ref, role, name, and children.

Example snapshot content:
```yaml
- role: navigation
  children:
    - role: link
      name: Dashboard
      ref: e12
    - role: link
      name: Settings
      ref: e13

- role: main
  children:
    - role: heading
      level: 1
      name: Welcome back, John
      ref: e14
    - role: button
      name: Export Report
      ref: e15
    - role: button
      name: Delete Account
      ref: e16
    - role: form
      children:
        - role: textbox
          name: Email address
          ref: e17
        - role: button
          name: Save Changes
          ref: e18
```

From this you can extract: headings, buttons, forms, links, and their refs.

---

## Monitoring Sessions

```bash
playwright-cli show    # open visual dashboard to watch all running sessions
```

Use this while debugging to see what the browser is doing in real time.
