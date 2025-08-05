# Real-time Chat Application

A real-time chat application built with Node.js, Express, Socket.IO, and MySQL. This application features user authentication, real-time messaging, and an online user list.

## Features

- User registration and login
- Real-time messaging
- Online user list
- Responsive design
- Message timestamps
- User connection/disconnection notifications

## Prerequisites

- Node.js (v14 or higher)
- MySQL (v5.7 or higher)
- npm or yarn

## Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd chat-app
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up the database:
   - Create a new MySQL database named `chat_app` (or any name you prefer)
   - Update the `.env` file with your database credentials

4. Start the application:
   ```bash
   # Development
   npm run dev

   # Production
   npm start
   ```

5. Open your browser and navigate to `http://localhost:3000`

## Configuration

Edit the `.env` file to configure your environment variables:

```
PORT=3000
DB_HOST=localhost
DB_USER=your_username
DB_PASSWORD=your_password
DB_NAME=chat_app
SESSION_SECRET=your-session-secret-key-here
```

## Project Structure

```
chat-app/
├── public/              # Static files
│   ├── css/             # Stylesheets
│   └── js/              # Client-side JavaScript
├── views/               # Server-side templates
│   └── layouts/         # Layout templates
├── .env                 # Environment variables
├── package.json         # Project dependencies
├── server.js            # Main application file
└── README.md            # Project documentation
```

## Technologies Used

- **Backend**: Node.js, Express
- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Real-time**: Socket.IO
- **Database**: MySQL
- **Templating**: Handlebars
- **Styling**: Tailwind CSS

