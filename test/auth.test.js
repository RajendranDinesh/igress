import request from 'supertest';
import { expect } from 'chai';
import app from '../src/app.js';

describe('Auth Routes', function() {
    describe('POST /register', function() {
        this.timeout(10000);
        it('should register a new user', async function() {
            const userData = {
                roll_no: "123456",
                email: "test@example.com",
                password: "password123",
                role: "staff"
            };

            const res = await request(app)
                .post('/api/auth/register')
                .send(userData);
            
            expect(res.status).to.equal(201);
            expect(res.body).to.have.property('message', 'User registered');
            expect(res.body).to.have.property('userId');
        });
    });

    describe('POST /login', function() {
        it('should login the user successfully', async function() {
            const loginData = {
                email: "test@example.com",
                password: "password123"
            };

            const res = await request(app)
                .post('/api/auth/login')
                .send(loginData);

            expect(res.status).to.equal(200);
            expect(res.body).to.have.property('message', 'Logged in successfully');
            expect(res.body).to.have.property('token');
            expect(res.body).to.have.property('userRole', 'staff');
        });

        it('should reject invalid credentials', async function() {
            const loginData = {
                email: "test@example.com",
                password: "wrongpassword"
            };

            const res = await request(app)
                .post('/api/auth/login')
                .send(loginData);

            expect(res.status).to.equal(401);
            expect(res.body).to.have.property('message', 'Invalid credentials');
        });
    });
});
