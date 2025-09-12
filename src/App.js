import React, { useState, useEffect } from 'react';
import initSqlJs from 'sql.js';
import './App.css'; // Add this for styling

function App() {
  const [data, setData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [searchName, setSearchName] = useState('');
  const [includeTags, setIncludeTags] = useState([]); // For tag search
  const [excludeTags, setExcludeTags] = useState([]);
  const [sortField, setSortField] = useState('Date');
  const [sortDirection, setSortDirection] = useState('asc');
  const [availableTags, setAvailableTags] = useState([]); // For tag dropdown

  // Load database and extract unique tags
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const arrayBuffer = await file.arrayBuffer();
      const SQL = await initSqlJs({
        locateFile: () => '/sql-wasm.wasm',
      });
      const db = new SQL.Database(new Uint8Array(arrayBuffer));

      // Main query
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

      // Get unique tags for dropdown
      const tagsQuery = `SELECT DISTINCT tag FROM tags;`;
      const tagsStmt = db.prepare(tagsQuery);
      const tags = [];
      while (tagsStmt.step()) {
        tags.push(tagsStmt.getAsObject().tag);
      }
      tagsStmt.free();
      db.close();

      setData(results);
      setFilteredData(results);
      setAvailableTags(tags.sort()); // Sort tags alphabetically
    } catch (error) {
      console.error('Error details:', error);
      alert('Failed to load or query the database. Ensure the file is a valid SQLite DB with the correct schema.');
    }
  };

  // Filter and sort data
  useEffect(() => {
    let filtered = [...data];

    // Search by name
    if (searchName) {
      filtered = filtered.filter((item) =>
        item.file.toLowerCase().includes(searchName.toLowerCase())
      );
    }

    // Include tags (all must match)
    if (includeTags.length > 0) {
      filtered = filtered.filter((item) => {
        const itemTags = item.tags.split(',').map((tag) => tag.trim().toLowerCase());
        return includeTags.every((tag) => itemTags.includes(tag.toLowerCase()));
      });
    }

    // Exclude tags
    if (excludeTags.length > 0) {
      filtered = filtered.filter((item) => {
        const itemTags = item.tags.split(',').map((tag) => tag.trim().toLowerCase());
        return !excludeTags.some((tag) => itemTags.includes(tag.toLowerCase()));
      });
    }

    // Sorting
    filtered.sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (sortField === 'tags') {
        valA = a.tags || '';
        valB = b.tags || '';
      } else if (sortField === 'Date') {
        valA = new Date(a.Date || '1970-01-01');
        valB = new Date(b.Date || '1970-01-01');
      } else if (sortField === 'chapters') {
        valA = Number(a.chapters) || 0; // Convert to number
        valB = Number(b.chapters) || 0;
      } else if (sortField === 'Done') {
        valA = a.Done === '✅' ? 1 : 0; // Treat ✅ as 1, ❌ as 0
        valB = b.Done === '✅' ? 1 : 0;
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    setFilteredData(filtered);
  }, [data, searchName, includeTags, excludeTags, sortField, sortDirection]);

  // Handle tag selection
  const handleAddIncludeTag = (tag) => {
    if (!includeTags.includes(tag)) {
      setIncludeTags([...includeTags, tag]);
    }
  };

  const handleAddExcludeTag = (tag) => {
    if (!excludeTags.includes(tag)) {
      setExcludeTags([...excludeTags, tag]);
    }
  };

  const handleRemoveIncludeTag = (tag) => {
    setIncludeTags(includeTags.filter((t) => t !== tag));
  };

  const handleRemoveExcludeTag = (tag) => {
    setExcludeTags(excludeTags.filter((t) => t !== tag));
  };

  const handleSort = (field) => {
    const newDirection = sortField === field && sortDirection === 'asc' ? 'desc' : 'asc';
    setSortField(field);
    setSortDirection(newDirection);
  };

  return (
    <div className="app-container">
      <h1>Obsidian Tags Reader</h1>
      <div className="file-upload">
        <input type="file" onChange={handleFileUpload} accept=".db" />
      </div>
      <div className="filters">
        <div className="filter-group">
          <label>Search by File Name:</label>
          <input
            type="text"
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
            placeholder="Enter file name..."
          />
        </div>
        <div className="filter-group">
          <label>Include Tags:</label>
          <select onChange={(e) => handleAddIncludeTag(e.target.value)} defaultValue="">
            <option value="" disabled>Select a tag</option>
            {availableTags.map((tag) => (
              <option key={tag} value={tag}>{tag}</option>
            ))}
          </select>
          <div className="tag-box">
            {includeTags.map((tag) => (
              <span key={tag} className="tag tag-include">
                {tag} <button onClick={() => handleRemoveIncludeTag(tag)}>×</button>
              </span>
            ))}
          </div>
        </div>
        <div className="filter-group">
          <label>Exclude Tags:</label>
          <select onChange={(e) => handleAddExcludeTag(e.target.value)} defaultValue="">
            <option value="" disabled>Select a tag</option>
            {availableTags.map((tag) => (
              <option key={tag} value={tag}>{tag}</option>
            ))}
          </select>
          <div className="tag-box">
            {excludeTags.map((tag) => (
              <span key={tag} className="tag tag-exclude">
                {tag} <button onClick={() => handleRemoveExcludeTag(tag)}>×</button>
              </span>
            ))}
          </div>
        </div>
      </div>
      {filteredData.length > 0 && (
        <table className="data-table">
          <thead>
            <tr>
              <th onClick={() => handleSort('file')}>
                File {sortField === 'file' && (sortDirection === 'asc' ? '▲' : '▼')}
              </th>
              <th onClick={() => handleSort('tags')}>
                Tags {sortField === 'tags' && (sortDirection === 'asc' ? '▲' : '▼')}
              </th>
              <th onClick={() => handleSort('Date')}>
                Date {sortField === 'Date' && (sortDirection === 'asc' ? '▲' : '▼')}
              </th>
              <th onClick={() => handleSort('chapters')}>
                Chapters {sortField === 'chapters' && (sortDirection === 'asc' ? '▲' : '▼')}
              </th>
              <th onClick={() => handleSort('Done')}>
                Done {sortField === 'Done' && (sortDirection === 'asc' ? '▲' : '▼')}
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((row, index) => (
              <tr key={index}>
                <td>{row.file}</td>
                <td>{row.tags}</td>
                <td>{row.Date}</td>
                <td>{row.chapters}</td>
                <td>{row.Done}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default App;
