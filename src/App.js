import React, { useState } from 'react';
import initSqlJs from 'sql.js';

// Note: To use sql.js in a Create React App project:
// 1. Run: npm install sql.js
// 2. Download sql-wasm.wasm from https://sql.js.org/dist/sql-wasm.wasm and place it in your public/ folder.
// 3. In your index.html or via webpack config, ensure the wasm is served correctly.

function App() {
  const [data, setData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [searchName, setSearchName] = useState('');
  const [excludeTags, setExcludeTags] = useState('');
  const [sortField, setSortField] = useState('Date');
  const [sortDirection, setSortDirection] = useState('asc');

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const arrayBuffer = await file.arrayBuffer();
    try {
      const SQL = await initSqlJs({
        locateFile: (file) => `/sql-wasm.wasm`, // Adjust if your public path differs
      });
      const db = new SQL.Database(new Uint8Array(arrayBuffer));

      const query = `
        SELECT f.file_name as file,
               GROUP_CONCAT(t.tag) as tags,
               SUBSTR(json_extract(f.metadata, '$.date'), 1, 10) as Date,
               json_extract(f.metadata, '$.chapters') as chapters,
               IIF(json_extract(f.metadata, '$.Finished')=1, '✅', '❌') as Done
        FROM files f
        JOIN file_tags ft ON f.id = ft.file_id
        JOIN tags t ON ft.tag_id = t.id
        GROUP BY f.id
        HAVING tags NOT LIKE '%dead%'
        ORDER BY Date;
      `;

      const results = [];
      const stmt = db.prepare(query);
      while (stmt.step()) {
        results.push(stmt.getAsObject());
      }
      stmt.free();
      db.close();

      setData(results);
      setFilteredData(results);
    } catch (error) {
      console.error('Error loading database or executing query:', error);
      alert('Failed to load or query the database. Ensure the file is a valid SQLite DB with the correct schema.');
    }
  };

  const applyFiltersAndSort = (name, excludes, field, direction) => {
    let filtered = [...data];

    // Search by name
    if (name) {
      filtered = filtered.filter((item) =>
        item.file.toLowerCase().includes(name.toLowerCase())
      );
    }

    // Exclude tags (anti-search)
    if (excludes) {
      const excludeList = excludes.split(',').map((tag) => tag.trim().toLowerCase());
      filtered = filtered.filter((item) => {
        const itemTags = item.tags.split(',').map((tag) => tag.trim().toLowerCase());
        return !excludeList.some((exclude) => itemTags.includes(exclude));
      });
    }

    // Sorting
    filtered.sort((a, b) => {
      let valA = a[field];
      let valB = b[field];

      if (field === 'tags') {
        valA = a.tags || '';
        valB = b.tags || '';
      } else if (field === 'Date') {
        valA = new Date(a.Date || '1970-01-01');
        valB = new Date(b.Date || '1970-01-01');
      }

      if (valA < valB) return direction === 'asc' ? -1 : 1;
      if (valA > valB) return direction === 'asc' ? 1 : -1;
      return 0;
    });

    setFilteredData(filtered);
  };

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchName(value);
    applyFiltersAndSort(value, excludeTags, sortField, sortDirection);
  };

  const handleExcludeChange = (e) => {
    const value = e.target.value;
    setExcludeTags(value);
    applyFiltersAndSort(searchName, value, sortField, sortDirection);
  };

  const handleSort = (field) => {
    const newDirection = sortField === field && sortDirection === 'asc' ? 'desc' : 'asc';
    setSortField(field);
    setSortDirection(newDirection);
    applyFiltersAndSort(searchName, excludeTags, field, newDirection);
  };

  return (
    <div style={{ padding: '20px' }}>
      <h1>Obsidian Tags Reader</h1>
      <input type="file" onChange={handleFileUpload} accept=".db" />
      <div style={{ marginTop: '20px' }}>
        <label>Search by File Name: </label>
        <input
          type="text"
          value={searchName}
          onChange={handleSearchChange}
          placeholder="Enter file name..."
        />
      </div>
      <div style={{ marginTop: '10px' }}>
        <label>Exclude Tags (comma-separated): </label>
        <input
          type="text"
          value={excludeTags}
          onChange={handleExcludeChange}
          placeholder="e.g., tag1,tag2"
        />
      </div>
      {filteredData.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px' }}>
          <thead>
            <tr>
              <th style={{ border: '1px solid #ddd', padding: '8px', cursor: 'pointer' }} onClick={() => handleSort('file')}>
                File {sortField === 'file' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th style={{ border: '1px solid #ddd', padding: '8px', cursor: 'pointer' }} onClick={() => handleSort('tags')}>
                Tags {sortField === 'tags' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th style={{ border: '1px solid #ddd', padding: '8px', cursor: 'pointer' }} onClick={() => handleSort('Date')}>
                Date {sortField === 'Date' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>Chapters</th>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>Done</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((row, index) => (
              <tr key={index}>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{row.file}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{row.tags}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{row.Date}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{row.chapters}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{row.Done}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default App;
