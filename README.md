# SaaS Quickstart Project

A modern SaaS quickstarter template that includes both frontend and backend components. Built with Vue.js 3, TypeScript, Tailwind CSS 4.0, tRPC, and PostgreSQL.

## Features

- **Magic Link Authentication**: Passwordless authentication using email magic links
- **Dashboard Interface**: Ready-to-use dashboard for your SaaS application
- **Role-based Authorization**: Admin and member user roles with appropriate permissions
- **API with tRPC**: Type-safe API with end-to-end typings
- **Database Integration**: PostgreSQL with TypeORM for data storage and migrations
- **Background Jobs**: PgBoss for reliable background job processing
- **Modern UI**: Responsive design with Tailwind CSS 4.0
- **Docker Integration**: Containerized development and deployment
- **Security Features**: Rate limiting and audit logging

## Project Structure

This project consists of two main parts:

- **`/client`**: Vue.js frontend application
- **`/server`**: Node.js backend application with tRPC

## Getting Started

### Prerequisites

- Docker and Docker Compose
- Node.js (for local development)
- npm or yarn

### Quick Start with Docker

1. Clone this repository:

```bash
git clone https://github.com/yourusername/quickstart-saas.git
cd quickstart-saas
```

2. Start the application using Docker Compose:

```bash
docker-compose up
```

This will start the client, server, PostgreSQL database, and MailHog (for email testing).

- **Client**: http://localhost
- **Server API**: http://localhost:3000
- **MailHog UI**: http://localhost:8025 (for viewing magic link emails)

### Creating an Admin User

To create an admin user:

1. Make sure your Docker containers are running:
```bash
docker-compose up -d
```

2. Execute the create-admin script inside the server container:
```bash
docker exec -it quickstart-saas_server_1 npm run create-admin your-email@example.com
```
Replace `your-email@example.com` with your desired admin email address.

3. If your container has a different name, check the actual name with `docker ps` and use that in the command.

4. To log in with your new admin account:
   - Go to the client application at http://localhost:5173
   - Enter your admin email
   - Click "Send Login Link"
   - Check MailHog UI at http://localhost:8025 to view and click the magic link
   - You'll be logged in with admin privileges

### Local Development

#### Client

```bash
cd client
npm install
npm run dev
```

The client will be available at http://localhost:5173.

#### Server

```bash
cd server
npm install
npm run dev
```

The server will be available at http://localhost:3000.

## License

This project is licensed under the MIT License - see the LICENSE file for details.