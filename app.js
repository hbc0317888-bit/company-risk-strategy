(function () {
  const data = window.STRATEGY_DATA;

  if (!data || !Array.isArray(data.nodes) || !Array.isArray(data.links)) {
    throw new Error("未找到战略导图数据。");
  }

  const nodesById = new Map(data.nodes.map((node) => [node.id, node]));
  const state = {
    currentView: "graph",
    selectedId: data.rootId,
    expanded: new Set([
      data.rootId,
      "corporateStrategy",
      "businessStrategy",
      "functionalStrategy"
    ]),
    search: ""
  };

  const elements = {
    contentGrid: document.querySelector(".content-grid"),
    currentViewLabel: document.querySelector("#current-view-label"),
    currentNodeLabel: document.querySelector("#current-node-label"),
    viewButtons: Array.from(document.querySelectorAll(".view-btn")),
    treeView: document.querySelector("#tree-view"),
    graphView: document.querySelector("#graph-view"),
    treeContainer: document.querySelector("#tree-container"),
    graphSvg: document.querySelector("#graph-svg"),
    graphViewport: document.querySelector("#graph-viewport"),
    searchInput: document.querySelector("#node-search"),
    expandAllBtn: document.querySelector("#expand-all-btn"),
    collapseAllBtn: document.querySelector("#collapse-all-btn"),
    detailFacts: document.querySelector("#detail-facts"),
    detailTitle: document.querySelector("#detail-title"),
    detailCategory: document.querySelector("#detail-category"),
    detailSummary: document.querySelector("#detail-summary"),
    detailPoints: document.querySelector("#detail-points"),
    detailChildren: document.querySelector("#detail-children"),
    detailRelations: document.querySelector("#detail-relations"),
    detailRelationSummary: document.querySelector("#detail-relation-summary"),
    detailStudyTips: document.querySelector("#detail-study-tips")
  };

  const categoryLabels = {
    root: "根节点",
    strategy: "战略层级",
    corporateType: "总体战略类型",
    businessType: "业务战略类型",
    functionalType: "职能战略类型"
  };

  const categoryFocusMap = {
    root: [
      "先把三大战略的层级关系看清，再去理解各自分工。",
      "适合从整体到局部记忆，先抓总纲，再看分类。"
    ],
    strategy: [
      "这一层是课程中的主干内容，答题时要突出“解决什么问题”。",
      "可以结合上位战略和下位战略一起记忆，更容易形成体系。"
    ],
    corporateType: [
      "这类节点通常适合放在“总体战略的类型”中进行对比记忆。",
      "答题时可从适用情境、目标和风险三个角度展开。"
    ],
    businessType: [
      "这类节点重点看竞争方式差异，如成本、特色或聚焦细分市场。",
      "容易和职能战略结合出题，记忆时要同步看支撑条件。"
    ],
    functionalType: [
      "这类节点属于执行保障层，适合和业务战略搭配记忆。",
      "答题时强调它如何支持竞争优势形成，会更完整。"
    ]
  };

  init();

  function init() {
    bindEvents();
    renderTree();
    renderGraph();
    selectNode(data.rootId, { preserveSearch: true });
    updateView();
  }

  function bindEvents() {
    elements.viewButtons.forEach((button) => {
      button.addEventListener("click", () => {
        state.currentView = button.dataset.view;
        updateView();
      });
    });

    elements.searchInput.addEventListener("input", (event) => {
      state.search = event.target.value.trim();
      if (state.search) {
        const firstMatch = findFirstMatch();
        if (firstMatch) {
          expandAncestors(firstMatch.id);
          state.selectedId = firstMatch.id;
          updateDetails();
          updateCurrentNodeLabel();
        }
      }
      renderTree();
      updateGraphSelection();
    });

    elements.expandAllBtn.addEventListener("click", () => {
      data.nodes.forEach((node) => {
        if (node.children && node.children.length) {
          state.expanded.add(node.id);
        }
      });
      renderTree();
    });

    elements.collapseAllBtn.addEventListener("click", () => {
      state.expanded = new Set([data.rootId]);
      expandAncestors(state.selectedId);
      renderTree();
    });

    [elements.detailChildren, elements.detailRelations].forEach((list) => {
      list.addEventListener("click", (event) => {
        const button = event.target.closest("[data-target-id]");
        if (!button) {
          return;
        }
        selectNode(button.dataset.targetId, { preserveSearch: true });
      });
    });
  }

  function renderTree() {
    const rootNode = nodesById.get(data.rootId);
    const rootList = document.createElement("ul");
    rootList.className = "tree-root";
    const rootItem = buildTreeItem(rootNode);
    if (rootItem) {
      rootList.appendChild(rootItem);
    }

    elements.treeContainer.innerHTML = "";
    elements.treeContainer.appendChild(rootList);
  }

  function buildTreeItem(node) {
    if (!nodeShouldAppear(node.id)) {
      return null;
    }

    const item = document.createElement("li");
    item.className = "tree-item";

    const row = document.createElement("div");
    row.className = "tree-row";

    const hasChildren = Array.isArray(node.children) && node.children.length > 0;
    const toggleButton = document.createElement("button");
    toggleButton.type = "button";
    toggleButton.className = "tree-toggle";
    toggleButton.textContent = state.search
      ? "•"
      : state.expanded.has(node.id)
        ? "−"
        : "+";

    if (!hasChildren) {
      toggleButton.classList.add("placeholder");
    } else {
      toggleButton.addEventListener("click", (event) => {
        event.stopPropagation();
        if (state.expanded.has(node.id)) {
          state.expanded.delete(node.id);
        } else {
          state.expanded.add(node.id);
        }
        renderTree();
      });
    }

    const nodeButton = document.createElement("button");
    nodeButton.type = "button";
    nodeButton.className = "tree-node-btn";
    if (node.id === state.selectedId) {
      nodeButton.classList.add("selected");
    }
    if (nodeMatchesSearch(node) && state.search) {
      nodeButton.classList.add("matched");
    }
    nodeButton.addEventListener("click", () => {
      selectNode(node.id, { preserveSearch: true });
    });

    const dot = document.createElement("span");
    dot.className = `node-dot ${node.category}`;

    const textWrap = document.createElement("span");
    textWrap.className = "node-text";

    const name = document.createElement("span");
    name.className = "node-name";
    name.textContent = node.label;

    const meta = document.createElement("span");
    meta.className = "node-meta";
    meta.textContent = `${categoryLabels[node.category] || "节点"} · 第${node.level}层`;

    textWrap.appendChild(name);
    textWrap.appendChild(meta);
    nodeButton.appendChild(dot);
    nodeButton.appendChild(textWrap);

    row.appendChild(toggleButton);
    row.appendChild(nodeButton);
    item.appendChild(row);

    const shouldShowChildren =
      hasChildren && (state.search || state.expanded.has(node.id));

    if (shouldShowChildren) {
      const childrenList = document.createElement("ul");
      childrenList.className = "tree-children";
      node.children.forEach((childId) => {
        const childNode = nodesById.get(childId);
        const childItem = buildTreeItem(childNode);
        if (childItem) {
          childrenList.appendChild(childItem);
        }
      });
      if (childrenList.children.length) {
        item.appendChild(childrenList);
      }
    }

    return item;
  }

  function renderGraph() {
    const linksGroup = createSvgElement("g", { class: "graph-links" });
    const nodesGroup = createSvgElement("g", { class: "graph-nodes" });

    data.links.forEach((link, index) => {
      const source = nodesById.get(link.source);
      const target = nodesById.get(link.target);
      const line = createSvgElement("line", {
        x1: source.position.x,
        y1: source.position.y,
        x2: target.position.x,
        y2: target.position.y,
        class: `graph-link ${link.type}`,
        "data-source": link.source,
        "data-target": link.target,
        "data-link-id": `link-${index}`
      });
      line.appendChild(
        createSvgElement("title", {}, `${source.label} ${link.label} ${target.label}`)
      );
      linksGroup.appendChild(line);
    });

    data.nodes.forEach((node) => {
      const group = createSvgElement("g", {
        class: `graph-node ${node.category}`,
        transform: `translate(${node.position.x} ${node.position.y})`,
        "data-node-id": node.id,
        tabindex: "0"
      });

      const radius = node.level === 0 ? 52 : node.level === 1 ? 42 : 34;
      const circle = createSvgElement("circle", { r: radius });
      const title = createSvgElement("title", {}, node.label);
      const text = createMultilineText(node.label);

      group.appendChild(circle);
      group.appendChild(text);
      group.appendChild(title);

      group.addEventListener("click", () => {
        selectNode(node.id, { preserveSearch: true });
        state.currentView = "graph";
        updateView();
      });

      group.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          selectNode(node.id, { preserveSearch: true });
        }
      });

      nodesGroup.appendChild(group);
    });

    elements.graphViewport.innerHTML = "";
    elements.graphViewport.appendChild(linksGroup);
    elements.graphViewport.appendChild(nodesGroup);
    updateGraphSelection();
  }

  function selectNode(nodeId, options) {
    state.selectedId = nodeId;
    if (!options || !options.preserveSearch) {
      state.search = "";
      elements.searchInput.value = "";
    }
    expandAncestors(nodeId);
    updateDetails();
    updateCurrentNodeLabel();
    renderTree();
    updateGraphSelection();
  }

  function updateDetails() {
    const node = nodesById.get(state.selectedId);
    const relatedNodes = getRelatedNodes(state.selectedId);
    const children = (node.children || []).map((childId) => nodesById.get(childId));
    const parentNode = node.parentId ? nodesById.get(node.parentId) : null;

    elements.detailTitle.textContent = node.label;
    elements.detailCategory.textContent = categoryLabels[node.category] || "节点";
    elements.detailSummary.textContent = node.summary;
    populateFactGrid(elements.detailFacts, [
      { label: "所属层级", value: `第${node.level}层` },
      { label: "节点类型", value: categoryLabels[node.category] || "节点" },
      { label: "上级节点", value: parentNode ? parentNode.label : "无" },
      { label: "下级数量", value: `${children.length} 个` },
      { label: "关联数量", value: `${relatedNodes.length} 个` },
      { label: "学习重点", value: getLearningFocus(node) }
    ]);
    populateBulletList(elements.detailPoints, node.keyPoints);
    populateTagList(elements.detailChildren, children.map((child) => ({
      label: child.label,
      targetId: child.id
    })));
    populateTagList(elements.detailRelations, relatedNodes.map((item) => ({
      label: `${item.label} · ${item.relationLabel}`,
      targetId: item.id
    })));
    populateNoteBlock(elements.detailRelationSummary, buildRelationSummary(node, parentNode, children, relatedNodes));
    populateBulletList(elements.detailStudyTips, buildStudyTips(node, parentNode, children, relatedNodes));
  }

  function updateCurrentNodeLabel() {
    const currentNode = nodesById.get(state.selectedId);
    elements.currentNodeLabel.textContent = currentNode.label;
  }

  function updateView() {
    const isTreeView = state.currentView === "tree";
    elements.contentGrid.classList.toggle("tree-mode", isTreeView);
    elements.treeView.classList.toggle("active", isTreeView);
    elements.graphView.classList.toggle("active", !isTreeView);
    elements.currentViewLabel.textContent = isTreeView ? "树状思维导图" : "关系网络图";

    elements.viewButtons.forEach((button) => {
      button.classList.toggle("active", button.dataset.view === state.currentView);
    });

    elements.expandAllBtn.disabled = !isTreeView;
    elements.collapseAllBtn.disabled = !isTreeView;
  }

  function updateGraphSelection() {
    const relatedIdSet = new Set(getRelatedNodes(state.selectedId).map((item) => item.id));

    elements.graphViewport.querySelectorAll(".graph-node").forEach((nodeElement) => {
      const nodeId = nodeElement.dataset.nodeId;
      const isSelected = nodeId === state.selectedId;
      const isRelated = relatedIdSet.has(nodeId);
      const matchesSearch =
        state.search && nodeMatchesSearch(nodesById.get(nodeId));

      nodeElement.classList.toggle("selected", isSelected);
      nodeElement.classList.toggle("related", !isSelected && isRelated);
      nodeElement.classList.toggle("matched", Boolean(matchesSearch));
      nodeElement.classList.toggle("faded", !isSelected && !isRelated);
    });

    elements.graphViewport.querySelectorAll(".graph-link").forEach((line) => {
      const isActive =
        line.dataset.source === state.selectedId || line.dataset.target === state.selectedId;
      line.classList.toggle("active", isActive);
      line.classList.toggle("faded", !isActive);
    });
  }

  function findFirstMatch() {
    const query = state.search.toLowerCase();
    return data.nodes.find((node) => {
      return (
        node.label.toLowerCase().includes(query) ||
        node.summary.toLowerCase().includes(query) ||
        node.keyPoints.some((point) => point.toLowerCase().includes(query))
      );
    });
  }

  function nodeMatchesSearch(node) {
    if (!state.search) {
      return false;
    }
    const query = state.search.toLowerCase();
    return (
      node.label.toLowerCase().includes(query) ||
      node.summary.toLowerCase().includes(query) ||
      node.keyPoints.some((point) => point.toLowerCase().includes(query))
    );
  }

  function nodeShouldAppear(nodeId) {
    if (!state.search) {
      return true;
    }

    const node = nodesById.get(nodeId);
    if (nodeMatchesSearch(node)) {
      return true;
    }

    return (node.children || []).some((childId) => nodeShouldAppear(childId));
  }

  function expandAncestors(nodeId) {
    let currentId = nodeId;
    while (currentId) {
      state.expanded.add(currentId);
      const currentNode = nodesById.get(currentId);
      currentId = currentNode.parentId;
    }
  }

  function getRelatedNodes(nodeId) {
    return data.links.reduce((items, link) => {
      if (link.source === nodeId) {
        items.push({
          id: link.target,
          label: nodesById.get(link.target).label,
          relationLabel: link.label
        });
      } else if (link.target === nodeId) {
        items.push({
          id: link.source,
          label: nodesById.get(link.source).label,
          relationLabel: link.label
        });
      }
      return items;
    }, []);
  }

  function getLearningFocus(node) {
    if (node.level === 0) {
      return "先总后分";
    }
    if (node.level === 1) {
      return "理解职责";
    }
    return "对比记忆";
  }

  function buildRelationSummary(node, parentNode, children, relatedNodes) {
    const containsCount = relatedNodes.filter((item) => item.relationLabel === "包含" || item.relationLabel === "类型" || item.relationLabel === "职能").length;
    const supportCount = relatedNodes.filter((item) => item.relationLabel !== "包含" && item.relationLabel !== "类型" && item.relationLabel !== "职能").length;

    const lines = [
      `${node.label}属于${categoryLabels[node.category] || "节点"}，在企业战略体系中主要承担“${inferNodeRole(node)}”的作用。`
    ];

    if (parentNode) {
      lines.push(`它的上级节点是${parentNode.label}，说明它需要放在“${parentNode.label}”这一部分中理解。`);
    }

    if (children.length) {
      lines.push(`它当前向下延伸出${children.length}个条目，适合继续拆分为更细的知识点。`);
    }

    if (containsCount || supportCount) {
      lines.push(`从关系上看，它与其他节点形成了${containsCount}项层级关系和${supportCount}项功能性关系。`);
    }

    return lines;
  }

  function buildStudyTips(node, parentNode, children, relatedNodes) {
    const tips = [...(categoryFocusMap[node.category] || [])];

    if (parentNode) {
      tips.push(`复习时先记住“${parentNode.label} -> ${node.label}”这条路径，层级会更清晰。`);
    }

    if (children.length) {
      tips.push(`当前节点下面还有${children.length}个下级条目，适合按“定义 - 类型 - 作用”继续展开。`);
    } else {
      tips.push("这是末级知识点，适合和同层节点做横向对比，强化记忆差异。");
    }

    if (relatedNodes.length) {
      tips.push(`可重点关注它与${relatedNodes[0].label}等节点的联系，这类关联常用于综合分析题。`);
    }

    return tips;
  }

  function inferNodeRole(node) {
    if (node.level === 0) {
      return "统领全局";
    }
    if (node.level === 1) {
      return "承上启下";
    }
    return "具体展开";
  }

  function populateBulletList(element, items) {
    element.innerHTML = "";
    if (!items || !items.length) {
      const emptyItem = document.createElement("li");
      emptyItem.className = "empty-state";
      emptyItem.textContent = "暂无内容";
      element.appendChild(emptyItem);
      return;
    }

    items.forEach((item) => {
      const listItem = document.createElement("li");
      listItem.textContent = item;
      element.appendChild(listItem);
    });
  }

  function populateFactGrid(element, items) {
    element.innerHTML = "";
    items.forEach((item) => {
      const wrapper = document.createElement("div");
      wrapper.className = "fact-item";

      const label = document.createElement("span");
      label.className = "fact-label";
      label.textContent = item.label;

      const value = document.createElement("strong");
      value.className = "fact-value";
      value.textContent = item.value;

      wrapper.appendChild(label);
      wrapper.appendChild(value);
      element.appendChild(wrapper);
    });
  }

  function populateNoteBlock(element, paragraphs) {
    element.innerHTML = "";
    paragraphs.forEach((text) => {
      const paragraph = document.createElement("p");
      paragraph.className = "detail-paragraph";
      paragraph.textContent = text;
      element.appendChild(paragraph);
    });
  }

  function populateTagList(element, items) {
    element.innerHTML = "";
    if (!items || !items.length) {
      const emptyItem = document.createElement("li");
      emptyItem.className = "empty-state";
      emptyItem.textContent = "暂无内容";
      element.appendChild(emptyItem);
      return;
    }

    items.forEach((item) => {
      const listItem = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "tag-button";
      button.textContent = item.label;
      if (item.targetId) {
        button.dataset.targetId = item.targetId;
      } else {
        button.disabled = true;
      }
      listItem.appendChild(button);
      element.appendChild(listItem);
    });
  }

  function createMultilineText(label) {
    const text = createSvgElement("text", {});
    const parts = splitLabel(label);
    const lineHeight = 18;

    parts.forEach((part, index) => {
      text.appendChild(
        createSvgElement(
          "tspan",
          {
            x: "0",
            dy: index === 0 ? `${-((parts.length - 1) * lineHeight) / 2}` : `${lineHeight}`
          },
          part
        )
      );
    });

    return text;
  }

  function splitLabel(label) {
    if (label.length <= 6) {
      return [label];
    }
    const middle = Math.ceil(label.length / 2);
    return [label.slice(0, middle), label.slice(middle)];
  }

  function createSvgElement(tagName, attributes, textContent) {
    const element = document.createElementNS("http://www.w3.org/2000/svg", tagName);
    Object.entries(attributes || {}).forEach(([key, value]) => {
      element.setAttribute(key, value);
    });
    if (textContent) {
      element.textContent = textContent;
    }
    return element;
  }

})();
