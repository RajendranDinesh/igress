import request from 'supertest';
import { expect } from 'chai';
import app from '../src/app.js';

describe('Special Routes', function() {
    describe('DELETE /api/auth/remove/:emailID', function() {
        it('should remove the user', async function() {

            const res = await request(app)
                .delete('/api/auth/remove/test@example.com')
            
            expect(res.status).to.equal(200);
            expect(res.body).to.have.property('message', 'User deleted');
        });
    });
});