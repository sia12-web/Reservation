# ClassmateFinder Backend

A Node.js + TypeScript backend for the ClassmateFinder application with Express, Prisma, and Socket.io.

## Tech Stack

- **Node.js** + **TypeScript**
- **Express** - Web framework
- **Prisma** - ORM for database management
- **Socket.io** - Real-time WebSocket communication
- **PostgreSQL** - Database

## Project Structure

```
backend/
├── prisma/
│   └── schema.prisma          # Database schema
├── src/
│   ├── config/
│   │   ├── database.ts        # Prisma client
│   │   ├── index.ts           # App configuration
│   │   └── socket.ts          # Socket.IO setup
│   ├── controllers/           # Route controllers
│   │   ├── auth.controller.ts
│   │   ├── user.controller.ts
│   │   ├── course.controller.ts
│   │   └── message.controller.ts
│   ├── middleware/            # Express middleware
│   │   ├── auth.ts
│   │   ├── errorHandler.ts
│   │   ├── notFoundHandler.ts
│   │   └── validator.ts
│   ├── routes/                # API routes
│   │   ├── auth.routes.ts
│   │   ├── user.routes.ts
│   │   ├── course.routes.ts
│   │   └── message.routes.ts
│   ├── types/                 # TypeScript types
│   ├── utils/                 # Utility functions
│   ├── app.ts                 # Express app setup
│   └── server.ts              # Server entry point
├── .env.example               # Environment variables template
├── package.json
└── tsconfig.json
```

## Setup Instructions

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env` and update the values:

```bash
cp .env.example .env
```

Update the following variables in `.env`:
- `DATABASE_URL` - Your PostgreSQL connection string
- `JWT_SECRET` - Generate a secure random string
- `PORT` - Server port (default: 5000)
- `CORS_ORIGIN` - Frontend URL

### 3. Set Up Database

Run Prisma migrations to create the database schema:

```bash
npx prisma migrate dev --name init
```

Generate Prisma Client:

```bash
npx prisma generate
```

(Optional) Open Prisma Studio to manage your database:

```bash
npx prisma studio
```

### 4. Start Development Server

```bash
npm run dev
```

The server will start on `http://localhost:5000`

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user

### Users
- `GET /api/users/me` - Get current user
- `PUT /api/users/me` - Update current user
- `GET /api/users/search?q=query&major=major&year=year` - Search users
- `GET /api/users/:id` - Get user by ID

### Courses
- `GET /api/courses?search=query&department=dept` - Get all courses
- `GET /api/courses/:id` - Get course by ID
- `POST /api/courses` - Create a new course
- `POST /api/courses/:id/enroll` - Enroll in a course
- `DELETE /api/courses/:id/enroll` - Unenroll from a course
- `GET /api/courses/:id/students` - Get course students

### Messages
- `GET /api/messages?courseId=id&receiverId=id` - Get messages
- `POST /api/messages` - Send a message
- `PUT /api/messages/:id/read` - Mark message as read
- `GET /api/messages/conversations` - Get all conversations

## Socket.IO Events

### Client → Server
- `join-course` - Join a course room
- `leave-course` - Leave a course room
- `typing-start` - Notify typing started
- `typing-stop` - Notify typing stopped
- `send-message` - Send a message via WebSocket

### Server → Client
- `new-message` - Receive a new message
- `user-typing` - User started typing
- `user-stopped-typing` - User stopped typing

## Database Schema

### Models
- **User** - User accounts and profiles
- **Course** - Course information
- **CourseEnrollment** - User-course enrollments
- **Message** - Direct messages and course messages

## Scripts

- `npm run dev` - Start development server with hot-reload
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Start production server
- `npm run prisma:generate` - Generate Prisma Client
- `npm run prisma:migrate` - Run database migrations
- `npm run prisma:studio` - Open Prisma Studio
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier

## Authentication

JWT tokens are used for authentication. Include the token in the Authorization header:

```
Authorization: Bearer <token>
```

## Error Handling

All errors follow this format:

```json
{
  "error": "Error message",
  "details": [] // Validation errors (if applicable)
}
```

## License

MIT
