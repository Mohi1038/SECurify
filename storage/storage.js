const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const writeFileAsync = promisify(fs.writeFile);
const readFileAsync = promisify(fs.readFile);
const mkdirAsync = promisify(fs.mkdir);

class Storage {
  constructor(storageDir = path.join(__dirname, 'data')) {
    this.storageDir = storageDir;
    this.init();
  }

  async init() {
    try {
      await mkdirAsync(this.storageDir, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') {
        console.error('Error initializing storage directory:', error);
      }
    }
  }

  async savePackets(packets, filename = `capture-${Date.now()}.json`) {
    const filePath = path.join(this.storageDir, filename);
    try {
      await writeFileAsync(filePath, JSON.stringify(packets, null, 2));
      return { success: true, filePath };
    } catch (error) {
      console.error('Error saving packets:', error);
      return { success: false, error: error.message };
    }
  }

  async loadPackets(filename) {
    const filePath = path.join(this.storageDir, filename);
    try {
      const data = await readFileAsync(filePath, 'utf8');
      return { success: true, packets: JSON.parse(data) };
    } catch (error) {
      console.error('Error loading packets:', error);
      return { success: false, error: error.message };
    }
  }

  async listCaptures() {
    try {
      const files = fs.readdirSync(this.storageDir);
      return { success: true, files: files.filter(file => file.endsWith('.json')) };
    } catch (error) {
      console.error('Error listing captures:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = Storage;
