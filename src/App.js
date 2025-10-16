import React, { useState, useEffect, useRef } from "react";
import initSqlJs from "sql.js";
import { TabulatorFull as Tabulator } from "tabulator-tables";
import Select from "react-select";
import "tabulator-tables/dist/css/tabulator.min.css";
import "tabulator-tables/dist/css/tabulator_midnight.min.css";
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
  defaultSortDir: "desc",
};

const REACT_APP_URL = process.env.REACT_APP_URL;

// Generate random color for tags - consistent across renders
// FIXED: Softer, more transparent colors - EASY ON EYES! 👀
// ✨ DYNAMIC: Colors generated ON-THE-FLY for REAL tags only!
const generateTagColors = () => {
  const baseColors = [
    [255, 107, 107],
    [78, 205, 196],
    [69, 183, 209],
    [150, 206, 180],
    [254, 202, 87],
    [255, 159, 243],
    [84, 160, 255],
    [95, 39, 205],
    [0, 210, 211],
    [255, 159, 67],
    [238, 90, 36],
    [16, 172, 132],
    [108, 92, 231],
    [0, 206, 201],
    [225, 112, 85],
    [162, 155, 254],
    [253, 203, 110],
    [253, 121, 168],
    [0, 184, 148],
    [162, 155, 254],
  ];

  return (tag) => {
    // Simple hash to get consistent color for each tag
    let hash = 0;
    for (let i = 0; i < tag.length; i++) {
      hash = tag.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % baseColors.length;
    const [r, g, b] = baseColors[index];
    return `rgba(${r}, ${g}, ${b}, 0.5)`;
  };
};

function App() {
  const [data, setData] = useState([]);
  const [unsortedFiltered, setUnsortedFiltered] = useState([]);
  const [searchName, setSearchName] = useState("");
  const [taggableFilters, setTaggableFilters] = useState({});
  const [availableValues, setAvailableValues] = useState({});
  const getTagColor = useRef(generateTagColors());
  const [config, setConfig] = useState(defaultConfig);
  const [configJson, setConfigJson] = useState(
    JSON.stringify(defaultConfig, null, 2),
  );
  const [dbBuffer, setDbBuffer] = useState(null);
  const [configVersion, setConfigVersion] = useState(0);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);

  const tableRef = useRef(null);
  const tabulatorInstance = useRef(null);

  // Toggle dark mode class on body
  useEffect(() => {
    if (isDarkMode) {
      document.body.classList.add("dark-mode");
    } else {
      document.body.classList.remove("dark-mode");
    }
  }, [isDarkMode]);

  // NEW: Generate colors when availableValues change
  // useEffect(() => {
  //   const allValues = [];
  //   Object.values(availableValues).forEach((values) => {
  //     allValues.push(...values);
  //   });
  //   if (allValues.length > 0) {
  //     setTagColors(generateTagColors(allValues));
  //   }
  // }, [availableValues]);

  const applyConfig = () => {
    try {
      const newConfig = JSON.parse(configJson);
      setConfig(newConfig);
      setConfigVersion((v) => v + 1);
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
          locateFile: () =>
            REACT_APP_URL ? `${REACT_APP_URL}/sql-wasm.wasm` : "/sql-wasm.wasm",
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

  // Filtering (without sorting)
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

    setUnsortedFiltered(filtered);
  }, [data, searchName, taggableFilters, config]);

  useEffect(() => {
    window.tagFilter = (col, value) => {
      handleAddTaggableFilter(col, value, "include");
    };
  }, []);
  const renderTaggableCell = (cell) => {
    const value = cell.getValue() || "";
    const tags = value
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag);

    if (tags.length === 0) return "";

    const htmlTags = tags
      .map(
        (tag) => `
      <span class="table-tag"
            style="background-color: ${getTagColor.current(tag)}; color: white;"
            title="Click to filter by: ${tag}"
            onclick="window.tagFilter('${cell.getColumn().getField()}', '${tag}')">
        ${tag}
      </span>
    `,
      )
      .join("");

    return `<div class="table-tag-container">${htmlTags}</div>`;
  };

  // Tabulator integration
  useEffect(() => {
    if (unsortedFiltered.length === 0) {
      if (tabulatorInstance.current) {
        tabulatorInstance.current.destroy();
        tabulatorInstance.current = null;
      }
      return;
    }

    const columns = config.columns.map((col) => {
      const colDef = {
        title: col.header,
        field: col.field,
        headerSort: true,
        resizable: true,
        headerHozAlign: "left",
      };

      if (col.type === "taggable") {
        colDef.formatter = (cell) => renderTaggableCell(cell); // This now works!
        colDef.hozAlign = "left";
        colDef.width = 250; // More space
        colDef.cssClass = "taggable-column"; // For styling
      } else if (col.type === "date") {
        colDef.sorter = (a, b) => {
          const getDateScore = (dateStr) => {
            if (!dateStr || dateStr === "") return 0;
            return 1;
          };

          const scoreA = getDateScore(a);
          const scoreB = getDateScore(b);

          if (scoreA !== scoreB) {
            return scoreB - scoreA;
          }

          return new Date(b).getTime() - new Date(a).getTime();
        };
        colDef.hozAlign = "left";
      } else if (col.type === "number") {
        colDef.sorter = "number";
        colDef.hozAlign = "right";
      } else if (col.type === "boolean") {
        colDef.sorter = "boolean";
        colDef.formatter = (cell) => {
          const val = cell.getValue();
          return val ? col.trueRender || "✅" : col.falseRender || "❌";
        };
        colDef.hozAlign = "center";
        colDef.width = 80;
      } else {
        colDef.hozAlign = "left";
      }

      return colDef;
    });

    if (!tabulatorInstance.current) {
      tabulatorInstance.current = new Tabulator(tableRef.current, {
        data: unsortedFiltered,
        columns,
        layout: "fitColumns",
        height: "calc(100vh - 150px)",
        selectable: false,
        initialSort: [
          { column: config.defaultSortField, dir: config.defaultSortDir },
        ],
      });
    } else {
      tabulatorInstance.current.setData(unsortedFiltered);
      tabulatorInstance.current.setColumns(columns);
    }

    if (tabulatorInstance.current) {
      const tableEl = tabulatorInstance.current.element;
      tableEl.classList.toggle("tabulator-midnight", isDarkMode);
    }
  }, [unsortedFiltered, config, isDarkMode]); // Added tagColors dependency

  // Destroy Tabulator on unmount
  useEffect(() => {
    return () => {
      if (tabulatorInstance.current) {
        tabulatorInstance.current.destroy();
      }
    };
  }, []);

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

  const customSelectStyles = {
    control: (provided, { isFocused }) => ({
      ...provided,
      backgroundColor: isDarkMode ? "#333" : "#fff",
      color: isDarkMode ? "#e0e0e0" : "#333",
      borderColor: isFocused ? "#007bff" : isDarkMode ? "#555" : "#ddd",
      boxShadow: isFocused ? "0 0 0 1px #007bff" : "none",
      "&:hover": {
        borderColor: isFocused ? "#007bff" : isDarkMode ? "#666" : "#bbb",
      },
      minHeight: "32px",
    }),
    valueContainer: (provided) => ({
      ...provided,
      color: isDarkMode ? "#e0e0e0" : "#333",
      padding: "2px 8px",
    }),
    input: (provided) => ({
      ...provided,
      color: isDarkMode ? "#e0e0e0" : "#333",
    }),
    placeholder: (provided) => ({
      ...provided,
      color: isDarkMode ? "#b0b0b0" : "#999",
    }),
    singleValue: (provided) => ({
      ...provided,
      color: isDarkMode ? "#e0e0e0" : "#333",
    }),
    menu: (provided) => ({
      ...provided,
      backgroundColor: isDarkMode ? "#333" : "#fff",
      marginTop: "2px",
    }),
    menuList: (provided) => ({
      ...provided,
      padding: "2px 0",
    }),
    option: (provided, { isFocused, isSelected }) => ({
      ...provided,
      backgroundColor: isSelected
        ? "#007bff"
        : isFocused
          ? isDarkMode
            ? "#444"
            : "#f0f0f0"
          : "transparent",
      color: isSelected ? "#fff" : isDarkMode ? "#e0e0e0" : "#333",
      "&:hover": {
        backgroundColor: isSelected
          ? "#007bff"
          : isDarkMode
            ? "#444"
            : "#f0f0f0",
      },
      padding: "8px 12px",
    }),
    multiValue: (provided) => ({
      ...provided,
      backgroundColor: isDarkMode ? "#444" : "#f0f0f0",
      color: isDarkMode ? "#e0e0e0" : "#333",
    }),
    multiValueLabel: (provided) => ({
      ...provided,
      color: isDarkMode ? "#e0e0e0" : "#333",
    }),
    multiValueRemove: (provided) => ({
      ...provided,
      color: isDarkMode ? "#e0e0e0" : "#666",
      "&:hover": {
        backgroundColor: isDarkMode ? "#555" : "#e0e0e0",
        color: isDarkMode ? "#fff" : "#333",
      },
    }),
    indicatorSeparator: (provided) => ({
      ...provided,
      backgroundColor: isDarkMode ? "#555" : "#ddd",
    }),
    dropdownIndicator: (provided) => ({
      ...provided,
      color: isDarkMode ? "#b0b0b0" : "#666",
    }),
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
    <div className={`app-container ${isDarkMode ? "dark-mode" : ""}`}>
      <div className="header">
        <h1>Database Reader</h1>
        <div className="header-controls">
          <button onClick={() => setIsConfigOpen(!isConfigOpen)}>
            {isConfigOpen ? "Hide Config" : "Show Config"}
          </button>
          <button onClick={() => setIsDarkMode(!isDarkMode)}>
            {isDarkMode ? "Light Mode" : "Dark Mode"}
          </button>
        </div>
      </div>
      {isConfigOpen && (
        <div className="config-section">
          <h2>Edit Config (JSON)</h2>
          <textarea
            value={configJson}
            onChange={(e) => setConfigJson(e.target.value)}
            rows={15}
            cols={80}
          />
          <button onClick={applyConfig}>Apply Config</button>
        </div>
      )}
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
        {taggableCols.map((col) => {
          const options = (availableValues[col.field] || []).map((value) => ({
            value,
            label: value,
          }));
          return (
            <div key={col.field} className="filter-group">
              <div>
                <label>Include {col.header}:</label>
                <Select
                  options={options}
                  onChange={(selected) =>
                    selected &&
                    handleAddTaggableFilter(
                      col.field,
                      selected.value,
                      "include",
                    )
                  }
                  placeholder={`Select a ${col.header.toLowerCase()}`}
                  isSearchable={true}
                  value={null}
                  styles={customSelectStyles}
                />
                <div className="tag-box">
                  {taggableFilters[col.field]?.include.map((value) => (
                    <span
                      key={value}
                      className="tag tag-include"
                      style={{
                        backgroundColor:
                          getTagColor.current(value) || "#007bff",
                      }}
                    >
                      {value}{" "}
                      <button
                        onClick={() =>
                          handleRemoveTaggableFilter(
                            col.field,
                            value,
                            "include",
                          )
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
                <Select
                  options={options}
                  onChange={(selected) =>
                    selected &&
                    handleAddTaggableFilter(
                      col.field,
                      selected.value,
                      "exclude",
                    )
                  }
                  placeholder={`Select a ${col.header.toLowerCase()}`}
                  isSearchable={true}
                  value={null}
                  styles={customSelectStyles}
                />
                <div className="tag-box">
                  {taggableFilters[col.field]?.exclude.map((value) => (
                    <span
                      key={value}
                      className="tag tag-exclude"
                      style={{
                        backgroundColor:
                          getTagColor.current(value) || "#ff4444",
                      }}
                    >
                      {value}{" "}
                      <button
                        onClick={() =>
                          handleRemoveTaggableFilter(
                            col.field,
                            value,
                            "exclude",
                          )
                        }
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div ref={tableRef} className="table-container"></div>
    </div>
  );
}

export default App;
