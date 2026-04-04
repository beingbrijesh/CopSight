import { EvidenceBookmark, User, Case } from '../src/models/index.js';
import sequelize from '../src/config/database.js';

async function testMapping() {
  try {
    console.log('--- Testing EvidenceBookmark Mapping ---');
    
    // Get a valid user and case
    const user = await User.findOne();
    const caseObj = await Case.findOne();
    
    if (!user || !caseObj) {
      console.error('Need at least one user and one case in DB to test.');
      return;
    }

    const testData = {
      caseId: caseObj.id,
      userId: user.id,
      evidenceType: 'chat',
      evidenceId: 'test_ev_id_' + Date.now(),
      source: 'test_source',
      content: 'This is test content',
      metadata: { raw: 'data', nested: { foo: 'bar' } },
      notes: 'Test note',
      tags: ['test']
    };

    console.log('Attempting to create bookmark with data:', JSON.stringify(testData, null, 2));
    
    const bookmark = await EvidenceBookmark.create(testData);
    
    console.log('✓ Success! Bookmark created with ID:', bookmark.id);
    console.log('Generated SQL should have included "evidence_source" and "evidence_content"');
    
    // Cleanup
    await bookmark.destroy();
    console.log('✓ Test cleanup: Bookmark removed.');

  } catch (err) {
    console.error('❌ Mapping Test Failed:', err.message);
    if (err.parent) console.error('DB Error:', err.parent.message);
  } finally {
    await sequelize.close();
  }
}

testMapping();
