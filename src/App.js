import React, { useState, useEffect } from "react";
import initSqlJs from "sql.js";
import "./App.css";

const defaultConfig = {
  mainQuery: `
    SELECT f.file_name as file,
           GROUP_CONCAT(DISTINCT t.tag) as tags,
           GROUP_CONCAT(DISTINCT fb.file_name) as backlinks,
           SUBSTR(json_extract(f.metadata, '$.date'), 1, 10) as Date,
           json_extract(f.metadata, '$.chapters') as chapters,
           json_extract(f.metadata, '$.Finished') as Done
    FROM files f
    LEFT JOIN file_tags ft ON f.id = ft.file_id
    LEFT JOIN tags t ON ft.tag_id = t.id
    LEFT JOIN backlinks b ON f.id = b.file_id
    LEFT JOIN files fb ON fb.id = b.backlink_id
    GROUP BY f.id
    HAVING tags NOT LIKE '%dead%';
  `,
  queries: {
    tags: `SELECT DISTINCT tag FROM tags;`,
    backlinks: `SELECT DISTINCT fb.file_name FROM backlinks b JOIN files fb ON fb.id = b.backlink_id;`,
  },
  textSearchColumn: "file",
  taggableColumns: ["tags", "backlinks"],
  columns: [
    { field: "file", header: "File", type: "text" },
    { field: "tags", header: "Tags", type: "taggable" },
    { field: "backlinks", header: "Backlinks", type: "taggable" },
    { field: "Date", header: "Date", type: "date" },
    { field: "chapters", header: "Chapters", type: "number" },
    {
      field: "Done",
      header: "Done",
      type: "boolean",
      trueRender: "✅",
      falseRender: "❌",
    },
  ],
  defaultSortField: "Date",
  defaultSortDir: "asc",
};

function App() {
  const [data, setData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [searchName, setSearchName] = useState("");
  const [taggableFilters, setTaggableFilters] = useState({});
  const [sortField, setSortField] = useState(defaultConfig.defaultSortField);
  const [sortDirection, setSortDirection] = useState(
    defaultConfig.defaultSortDir,
  );
  const [availableValues, setAvailableValues] = useState({});
  const [config, setConfig] = useState(defaultConfig);
  const [configJson, setConfigJson] = useState(
    JSON.stringify(defaultConfig, null, 2),
  );
  const [dbBuffer, setDbBuffer] = useState(null);
  const [configVersion, setConfigVersion] = useState(0);

  const applyConfig = () => {
    try {
      const newConfig = JSON.parse(configJson);
      setConfig(newConfig);
      setConfigVersion((v) => v + 1);
      setSortField(
        newConfig.defaultSortField || newConfig.columns[0]?.field || "",
      );
      setSortDirection(newConfig.defaultSortDir || "asc");
      setTaggableFilters(
        Object.fromEntries(
          (newConfig.taggableColumns || []).map((col) => [
            col,
            { include: [], exclude: [] },
          ]),
        ),
      );
      setConfigJson(JSON.stringify(newConfig, null, 2));
    } catch (e) {
      alert("Invalid JSON: " + e.message);
    }
  };

  useEffect(() => {
    if (!dbBuffer) return;

    const process = async () => {
      try {
        const SQL = await initSqlJs({
          locateFile: () => "/sql-wasm.wasm",
        });
        const db = new SQL.Database(new Uint8Array(dbBuffer));

        const results = [];
        const stmt = db.prepare(config.mainQuery);
        while (stmt.step()) {
          results.push(stmt.getAsObject());
        }
        stmt.free();

        const available = {};
        for (const [col, query] of Object.entries(config.queries || {})) {
          const values = [];
          const stmt = db.prepare(query);
          while (stmt.step()) {
            values.push(stmt.get()[0]);
          }
          stmt.free();
          available[col] = values.sort();
        }

        db.close();

        setData(results);
        setFilteredData(results);
        setAvailableValues(available);
      } catch (error) {
        console.error("Error details:", error);
        alert(
          "Failed to load or query the database. Ensure the file is a valid SQLite DB and config queries match the schema.",
        );
      }
    };

    process();
  }, [dbBuffer, configVersion, config]);

  useEffect(() => {
    let filtered = [...data];

    if (searchName && config.textSearchColumn) {
      filtered = filtered.filter((item) =>
        (item[config.textSearchColumn] || "")
          .toLowerCase()
          .includes(searchName.toLowerCase()),
      );
    }

    for (const [col, { include, exclude }] of Object.entries(taggableFilters)) {
      if (include.length > 0) {
        filtered = filtered.filter((item) => {
          const itemValues = (item[col] || "")
            .split(",")
            .map((v) => v.trim().toLowerCase());
          return include.every((v) => itemValues.includes(v.toLowerCase()));
        });
      }
      if (exclude.length > 0) {
        filtered = filtered.filter((item) => {
          const itemValues = (item[col] || "")
            .split(",")
            .map((v) => v.trim().toLowerCase());
          return !exclude.some((v) => itemValues.includes(v.toLowerCase()));
        });
      }
    }

    filtered.sort((a, b) => {
      const col = config.columns.find((c) => c.field === sortField);
      const type = col ? col.type : "text";
      let valA = getSortValue(a[sortField], type);
      let valB = getSortValue(b[sortField], type);

      if (valA < valB) return sortDirection === "asc" ? -1 : 1;
      if (valA > valB) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    setFilteredData(filtered);
  }, [data, searchName, taggableFilters, sortField, sortDirection, config]);

  const getSortValue = (val, type) => {
    if (type === "date") return new Date(val || "1970-01-01");
    if (type === "number") return Number(val) || 0;
    if (type === "boolean") return val ? 1 : 0;
    return val || "";
  };

  const renderValue = (row, col) => {
    const val = row[col.field];
    if (col.type === "boolean") {
      return val ? col.trueRender : col.falseRender;
    }
    return val;
  };

  const handleAddTaggableFilter = (col, value, type) => {
    if (!value) return;
    setTaggableFilters((prev) => {
      const filters = { ...prev };
      if (!filters[col]) filters[col] = { include: [], exclude: [] };
      if (type === "include" && !filters[col].include.includes(value)) {
        filters[col].include.push(value);
      } else if (type === "exclude" && !filters[col].exclude.includes(value)) {
        filters[col].exclude.push(value);
      }
      return filters;
    });
  };

  const handleRemoveTaggableFilter = (col, value, type) => {
    setTaggableFilters((prev) => {
      const filters = { ...prev };
      if (type === "include") {
        filters[col].include = filters[col].include.filter((v) => v !== value);
      } else {
        filters[col].exclude = filters[col].exclude.filter((v) => v !== value);
      }
      return filters;
    });
  };

  const handleSort = (field) => {
    const newDirection =
      sortField === field && sortDirection === "asc" ? "desc" : "asc";
    setSortField(field);
    setSortDirection(newDirection);
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const arrayBuffer = await file.arrayBuffer();
      setDbBuffer(arrayBuffer);
    } catch (error) {
      console.error("Error reading file:", error);
      alert("Failed to read the file.");
    }
  };

  const textCol = config.textSearchColumn
    ? config.columns.find((c) => c.field === config.textSearchColumn)
    : null;
  const taggableCols = config.taggableColumns
    ? config.columns.filter(
        (c) =>
          config.taggableColumns.includes(c.field) && c.type === "taggable",
      )
    : [];

  return (
    <div className="app-container">
      <h1>Database Reader</h1>
      <div className="config-section">
        <h2>Edit Config (JSON)</h2>
        <textarea
          value={configJson}
          onChange={(e) => setConfigJson(e.target.value)}
          rows={20}
          cols={80}
        />
        <button onClick={applyConfig}>Apply Config</button>
      </div>
      <div className="file-upload">
        <input type="file" onChange={handleFileUpload} accept=".db" />
      </div>
      <div className="filters">
        {textCol && (
          <div className="filter-group">
            <label>Search by {textCol.header}:</label>
            <input
              type="text"
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              placeholder={`Enter ${textCol.header.toLowerCase()}...`}
            />
          </div>
        )}
        {taggableCols.map((col) => (
          <div key={col.field} className="filter-group">
            <div>
              <label>Include {col.header}:</label>
              <select
                onChange={(e) =>
                  handleAddTaggableFilter(col.field, e.target.value, "include")
                }
                value=""
              >
                <option value="" disabled>
                  Select a {col.header.toLowerCase()}
                </option>
                {(availableValues[col.field] || []).map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
              <div className="tag-box">
                {taggableFilters[col.field]?.include.map((value) => (
                  <span key={value} className="tag tag-include">
                    {value}{" "}
                    <button
                      onClick={() =>
                        handleRemoveTaggableFilter(col.field, value, "include")
                      }
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
            <div>
              <label>Exclude {col.header}:</label>
              <select
                onChange={(e) =>
                  handleAddTaggableFilter(col.field, e.target.value, "exclude")
                }
                value=""
              >
                <option value="" disabled>
                  Select a {col.header.toLowerCase()}
                </option>
                {(availableValues[col.field] || []).map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
              <div className="tag-box">
                {taggableFilters[col.field]?.exclude.map((value) => (
                  <span key={value} className="tag tag-exclude">
                    {value}{" "}
                    <button
                      onClick={() =>
                        handleRemoveTaggableFilter(col.field, value, "exclude")
                      }
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
      {filteredData.length > 0 && (
        <table className="data-table">
          <thead>
            <tr>
              {config.columns.map((col) => (
                <th key={col.field} onClick={() => handleSort(col.field)}>
                  {col.header}{" "}
                  {sortField === col.field &&
                    (sortDirection === "asc" ? "▲" : "▼")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredData.map((row, index) => (
              <tr key={index}>
                {config.columns.map((col) => (
                  <td key={col.field}>{renderValue(row, col)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default App;
