# Akda - A Modern Cross-Platform PDF Annotation Tool

![Akda Banner](https://placehold.co/1200x400/000000/FFFFFF/png?text=Akda)

**Akda** is a powerful, open-source PDF annotation and note-taking tool designed for students, researchers, and professionals who work across multiple operating systems.  
Built with a modern tech stack, Akda offers a **fast**, **lightweight**, and **intuitive** experience for reading, annotating, and managing your PDF documents — without the heavy resource usage of a web browser.

---

## 💡 Why Akda Exists

The main motivation behind **Akda** is simple:

> I use multiple environments — macOS, Windows, and Ubuntu Linux — and I need a single, consistent app to take notes and annotate PDFs across all of them.

Opening PDFs in full-fledged browsers like Chrome or Edge often consumes too much RAM, which makes multitasking difficult. Akda solves this problem by giving you **fine-grained control** over your PDF reading and annotation workflow while keeping memory usage low and performance high.

With Akda, your annotations and notes stay synchronized across your devices, and you stay productive no matter which OS you’re using.

---

## ✨ Features

- **🌍 Cross-Platform:** Works seamlessly on Windows, macOS, and Linux.  
- **🧠 Intelligent Notes:** Highlight, underline, strikethrough, and add notes directly to your PDFs.  
- **🧩 Modular Architecture:** Easily extend Akda with your own plugins or features.  
- **⚡ Built for Speed:** Lightweight Rust + Tauri backend ensures blazing-fast performance and minimal memory usage.  
- **🧭 Clean Interface:** A modern and minimal interface built with React and shadcn/ui.  
- **🔐 Open Source:** Licensed under **AGPL-3.0-or-later** — free to use, modify, and share.

---

## 🛠️ Tech Stack

- **[Tauri](https://tauri.app/):** Lightweight framework for secure and fast desktop apps.  
- **[React](https://react.dev/):** UI built for responsiveness and modern design.  
- **[TypeScript](https://www.typescriptlang.org/):** For reliable and maintainable code.  
- **[Vite](https://vitejs.dev/):** Lightning-fast development and build tool.  
- **[Rust](https://www.rust-lang.org/):** Handles heavy PDF processing and system operations efficiently.  
- **[shadcn/ui](https://ui.shadcn.com/):** Elegant UI components built on Radix primitives.  
- **[Zustand](https://zustand-demo.pmnd.rs/):** Lightweight state management for local and synced app state.  
- **[TanStack Query](https://tanstack.com/query/latest):** Manages async state, caching, and data synchronization.

---

## 🏛️ System Architecture

**Akda** follows a hybrid architecture combining a web-based frontend and a native Rust backend:

- **Frontend (React + Vite):**  
  Renders the UI, manages state, and handles user interaction.

- **Backend (Rust + Tauri):**  
  Manages native OS features like file access, windowing, and PDF parsing.  
  Provides a secure IPC bridge for communication with the frontend.

- **IPC Communication:**  
  Frontend and backend exchange data through Tauri’s secure Inter-Process Communication (IPC) layer, ensuring speed and safety.

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)  
- [Rust](https://rustup.rs/) (latest stable)  
- Platform dependencies ([Tauri Prerequisites](https://tauri.app/v1/guides/getting-started/prerequisites))

### Installation

```bash
git clone https://github.com/marbelona/akda.git
cd akda
npm install
npm run tauri:dev
```

### Build for Production

```bash
npm run tauri:build
```

The compiled binaries will be located in `src-tauri/target/release`.

---

## 🧭 Future Plans

Akda is just getting started. The roadmap includes exciting features that push cross-platform note-taking even further:

### ☁️ Cloud Sync via Google Drive

- Store your **annotations, highlights, and notes** directly in Google Drive.  
- Automatic synchronization of app state across all your devices.  
- Background updates to keep your environment in sync (Windows ↔ macOS ↔ Linux).  
- No central server — your data stays in **your Google Drive**.

### 📓 Smart Notebook System

- Create custom notebooks to organize your PDFs and notes.  
- Add, remove, or reorder pages seamlessly.  

### 🧩 Dynamic Title Bar per OS

- Adaptive title bar styling that adjusts based on your operating system (macOS, Windows, Linux).  
- Ensures a consistent but native feel across platforms.  
- Supports native window buttons and dark/light mode variations.

### ⚙️ Enhanced Performance & UX

- Multi-tab PDF viewer for quick switching between documents.  
- Quick-search and global annotation indexing.

---

## 🤝 Contributing

WIP

---

## 🙌 Credits

- Huge thanks to [@dannysmith](https://github.com/dannysmith) for creating the excellent [Tauri Template](https://github.com/dannysmith/tauri-template), which provided a solid foundation for Akda’s production-ready setup.  

---

## 📜 License

**Akda** is licensed under the **AGPL-3.0-or-later** license.  
See [LICENSE.md](LICENSE.md) for more details.
