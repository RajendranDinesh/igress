import request from 'supertest';
import { expect } from 'chai';
import app from '../src/app.js';

async function login() {
    const loginData = {
        email: "test@example.com",
        password: "password123"
    };
    
    const authRes = await request(app)
        .post('/api/auth/login')
        .send(loginData);
    
    const token = authRes.body.token;

    return token;
}

describe('Classroom Routes', function() {
    describe('POST /create', function() {
        it('should create a new classroom', async function() {

            const token = await login();

            const classroomData = {
                name: "Math Class",
                description: "Introduction to Algebra"
            };

            const res = await request(app)
                .post('/api/classroom/create')
                .set('Authorization', `Bearer ${token}`)
                .send(classroomData);

            expect(res.status).to.equal(201);
            expect(res.body).to.have.property('message', 'Classroom created');
            expect(res.body).to.have.property('classroomId');
        });

        it('should return a 400 error for missing name field', async function() {
            const token = await login();

            const classroomData = {
                description: "Introduction to Algebra"
            };

            const res = await request(app)
                .post('/api/classroom/create')
                .set('Authorization', `Bearer ${token}`)
                .send(classroomData);

            expect(res.status).to.equal(400);
            expect(res.body).to.have.property('error', 'Name is required');
        });
    });

    describe('GET /all', function() {
        it('should retrieve all classrooms successfully', async function() {
            const token = await login();

            const res = await request(app)
                .get('/api/classroom/all')
                .set('Authorization', `Bearer ${token}`);
            
            expect(res.status).to.equal(200);
            expect(res.body).to.be.an('array');
        });
    });

});
