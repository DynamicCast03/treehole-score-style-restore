// ==UserScript==
// @name PKU树洞成绩查询样式恢复（平均分/绩点切换版）
// @namespace http://tampermonkey.net/
// @version 4.0
// @description 恢复PKU树洞成绩查询页面的样式，支持在以平均分为主和以绩点为主的双模式间一键切换，并保留百分制/四分制着色切换。适配移动端树洞与电脑端树洞。
// @author cbt
// @match *://treehole.pku.edu.cn/*
// @grant none
// ==/UserScript==

(function () {
  "use strict";

  const GRADE_MAP = {
    P: null, NP: null, EX: null, IP: null, I: null, W: null,
    "A+": 4, A: 4, "A-": 3.7, "B+": 3.3, B: 3, "B-": 2.7,
    "C+": 2.3, C: 2, "C-": 1.7, "D+": 1.3, D: 1, F: null,
  };

  const SPECIAL_TEXT = {
    P: "通过", NP: "未通过", EX: "免修", IP: "跨学期", I: "缓考", W: "退课",
  };

  // 默认：百分制着色模式（isGPAColorMode = false）且主显计算方式以平均分为主（isAverageScoreMode = true）
  let isGPAColorMode = false;
  let isAverageScoreMode = true;

  function scoreToGPA(score) {
    if (score === null || score === undefined) return null;
    if (typeof score === "string") {
      if (GRADE_MAP.hasOwnProperty(score)) return GRADE_MAP[score];
      let n = parseFloat(score);
      if (!isNaN(n)) score = n;
      else return null;
    }
    return score >= 60 ? 4 - (3 * Math.pow(100 - score, 2)) / 1600 : null;
  }

  function gpaTo100(gpa) {
    if (gpa === null) return null;
    if (gpa >= 4) return 100;
    if (gpa >= 1) return (-40 * Math.sqrt(3) * Math.sqrt(4 - gpa) + 300) / 3;
    return null;
  }

  function gpaTo100Display(gpa) {
    let v = gpaTo100(gpa);
    return v === null ? "--.-" : v;
  }

  function calcRatio(score, isGPA) {
    if (score === null || score === undefined) return 0;
    if (isGPA) {
      let gpa = scoreToGPA(score);
      if (gpa === null) return 0;
      return (gpa - 1) / 3;
    }
    let s100;
    if (typeof score === "number") {
      s100 = score;
    } else {
      let gpa = scoreToGPA(score);
      if (gpa === null) return 0;
      s100 = gpaTo100(gpa);
    }
    return Math.max(0, Math.min(1, (s100 - 60) / 40));
  }

  function isNull(score) { return scoreToGPA(score) === null; }
  function isFail(score) { return score === "NP" || score === "F" || (typeof score === "number" && score < 60); }

  function getTitleColor(score, isGPA) {
    if (isNull(score)) return "hsl(240,30%,88%)";
    return `hsl(${120 * calcRatio(score, isGPA)},${isGPA ? 97 : 100}%,70%)`;
  }

  function getGradient(score, isGPA) {
    if (isNull(score) || (typeof score === "number" && score < 60)) {
      let ratio = isFail(score) ? 0 : 1;
      let pct = ratio * 100 + "%";
      return { bg: `linear-gradient(to right, hsl(240,30%,88%), hsl(240,30%,88%) ${pct}, hsl(340,60%,65%) ${pct})`, ratio };
    }
    let r = calcRatio(score, isGPA);
    let c1 = `hsl(${120 * r},${isGPA ? 97 : 100}%,75%)`;
    let c2 = `hsl(${120 * r},${isGPA ? 97 : 100}%,70%)`;
    let c3 = `hsl(${120 * r},${isGPA ? 57 : 60}%,65%)`;
    let pct = Math.max(r, 0.01) * 100 + "%";
    return { bg: `linear-gradient(to right, ${c1}, ${c2} ${pct}, ${c3} ${pct})`, ratio: Math.max(r, 0.01) };
  }

  function formatNumber(n, decimals) {
    if (typeof n !== "number") return n;
    return n.toFixed(decimals).replace(/\.?0+$/, "");
  }

  // 获取课程成绩单行绩点展示：统一限制为 2 位小数
  function getGPADisplay(score) {
    let gpa = scoreToGPA(score);
    if (gpa !== null) return gpa.toFixed(2);
    if (typeof score === "string" && SPECIAL_TEXT[score]) return SPECIAL_TEXT[score];
    return "-.--";
  }

  function getScoreDisplay(score) {
    if (typeof score == "string" && score == "合格") return "P";
    if (typeof score == "string" && score == "缓考") return "I";
    if (typeof score === "number") return formatNumber(score, 1);
    return score || "-.--";
  }

  (function () {
    let style = document.createElement("style");
    style.textContent = `
      .layout-vertical-down, .layout-vertical-extra, .layout-vertical-extra * { color: #333333 !important; }
      .semester-block > :first-child .layout-row { padding-top: 0.25em !important; padding-bottom: 0.25em !important; color: #333333 !important; }
      .semester-block > :first-child { box-shadow: 0 0 6px rgba(0,0,0,.8) !important; border: none !important; }
      .semester-block-bottom > :first-child, [data-gm-overall="1"] > :first-child { box-shadow: 0 0 6px rgba(0,0,0,.8) !important; border: none !important; }
      .semester-block-bottom > :first-child .layout-row, [data-gm-overall="1"] > :first-child .layout-row { padding-top: 0.25em !important; padding-bottom: 0.25em !important; color: #333333 !important; }
      .course-row { box-shadow: 0 -1px 0 #7f7f7f !important; border: none !important; }
      .course-row .layout-row { color: #333333 !important; }
      .layout-row-right .layout-vertical-up { color: #333333 !important; }
      .semester-block-bottom, .semester-block-bottom *:not(.course-badge):not(.icon), [data-gm-overall="1"], [data-gm-overall="1"] *:not(.course-badge):not(.icon) { color: #333333 !important; }
      .rainbow-moving { background-image: linear-gradient(-45deg,#c5fcc5,#ffd1d1,#d1d1ff,#c5fcc5,#ffd1d1,#d1d1ff,#c5fcc5,#ffd1d1,#d1d1ff,#c5fcc5,#ffd1d1,#d1d1ff,#c5fcc5) !important; background-size: 1800px 200px !important; }
      .gm-credit-cell { flex: 0 0 2.5em; text-align: center; }
      .gm-credit-cell .layout-vertical-up { font-size: 1em; }
      .gm-credit-cell .layout-vertical-down { font-size: 60%; }
      .controller-bar a { cursor: pointer; }
      #gm-color-toggle { margin-left: 0.8em; cursor: pointer; }
      #gm-mode-toggle { margin-left: 0.8em; cursor: pointer; }
    `;
    if (document.head) document.head.appendChild(style);
    else document.addEventListener("DOMContentLoaded", () => document.head.appendChild(style));
  })();

  let gmOrderCounter = 0;

  function getDataVAttrs(el) {
    if (!el) return [];
    return Array.from(el.attributes)
      .filter(a => a.name.startsWith("data-v-"))
      .map(a => [a.name, a.value]);
  }

  function applyDataVAttrs(el, attrs) {
    if (attrs && attrs.length) attrs.forEach(a => el.setAttribute(a[0], a[1]));
    return el;
  }

  function parseScore(text) {
    if (!text) return null;
    text = text.trim();
    if (text === "合格") return "P";
    if (text.includes("缓考")) return "I";
    if (text.includes("跨学期")) return "IP";
    if (text.includes("退课")) return "W";
    if (GRADE_MAP.hasOwnProperty(text)) return text;
    if (SPECIAL_TEXT.hasOwnProperty(text)) {
      for (let k in SPECIAL_TEXT) if (SPECIAL_TEXT[k] === text) return k;
    }
    let n = parseFloat(text);
    return isNaN(n) ? text : n;
  }

  // 过滤一些特定状态或不计入计算的课程（已修复：增加 NP 排除）
  function isEffective(score) {
    if (score === "W" || score === "I" || score === "IP" || score === "F" || score === "NP") return false;
    if (typeof score === "number" && score < 60) return false;
    return true;
  }

  function getCreditFromRow(row) {
    let leftDiv = row.querySelector(".layout-row-left .layout-vertical-up");
    return leftDiv ? (parseFloat(leftDiv.textContent) || 0) : 0;
  }

  function getScoreFromRow(row) {
    let rightDiv = row.querySelector(".layout-row-right .layout-vertical-up");
    return rightDiv ? parseScore(rightDiv.textContent) : null;
  }

  // 获取该行原有的详细类型（课程类别等）
  function getDetailsFromRow(row) {
    let detailsDiv = row.querySelector(".layout-row-middle .layout-vertical-down");
    return detailsDiv ? detailsDiv.textContent.trim() : "";
  }

  function parseTeacherInfo(rawTeacher) {
    if (!rawTeacher) return "（无教师信息）";
    let parts = rawTeacher.split(",");
    let first = parts[0];
    let match = /^[^-]+-([^$]+)\$([^$]*)\$([^$]*)$/.exec(first);
    if (match) {
      let name = match[1], org = match[2];
      let suffix = parts.length > 1 ? `等${parts.length}人` : "";
      return `${name}（${org}）${suffix}`;
    }
    return first + (parts.length > 1 ? ` 等${parts.length}人` : "");
  }

  // 从额外折叠项中提取教师信息
  function getTeacherFromExtras(row) {
    let extraDiv = row.querySelector(".layout-vertical-extra");
    if (!extraDiv) return null;
    for (let p of extraDiv.querySelectorAll("p")) {
      let b = p.querySelector("b");
      if (b && b.textContent.includes("教师信息")) {
        let span = p.querySelector("span");
        if (span) return span.textContent.trim();
      }
    }
    return null;
  }

  function getCourseTypeFromRow(row) {
    let detailsDiv = row.querySelector(".layout-row-middle .layout-vertical-down");
    if (!detailsDiv) return "";
    let t = detailsDiv.textContent.trim();
    let i = t.indexOf(" - ");
    return i === -1 ? t : t.slice(0, i);
  }

  function getCourseNameFromRow(row) {
    let nameDiv = row.querySelector(".layout-row-middle .layout-vertical-up");
    return nameDiv ? nameDiv.textContent.trim() : "";
  }

  // 计算加权平均分（百分制）
  function calcWeightedScore(courseData) {
    let totalCredit = 0, totalWeighted = 0;
    courseData.forEach(c => {
      if (typeof c.score === "number" && c.credit > 0 && isEffective(c.score)) {
        totalCredit += c.credit;
        totalWeighted += c.credit * c.score;
      }
    });
    return totalCredit > 0 ? totalWeighted / totalCredit : null;
  }

  // 计算加权绩点（四分制）
  function calcWeightedGPA(courseData) {
    let totalCredit = 0, totalWeighted = 0;
    courseData.forEach(c => {
      let gpa = scoreToGPA(c.score);
      if (gpa !== null && c.credit > 0 && isEffective(c.score)) {
        totalCredit += c.credit;
        totalWeighted += c.credit * gpa;
      }
    });
    return totalCredit > 0 ? totalWeighted / totalCredit : null;
  }

  function sortCourses(courseData) {
    return courseData.slice().sort((a, b) => {
      let gpaA = scoreToGPA(a.score), gpaB = scoreToGPA(b.score);
      if (gpaA !== gpaB) {
        if (gpaB === null) return -1;
        if (gpaA === null) return 1;
        return gpaB - gpaA;
      }
      let failA = isFail(a.score) ? 1 : 0, failB = isFail(b.score) ? 1 : 0;
      if (failA !== failB) return failA - failB;
      return a.origIndex - b.origIndex;
    });
  }

  let rainbowStyleInjected = false;
  function ensureRainbowKeyframes() {
    if (rainbowStyleInjected) return;
    let style = document.createElement("style");
    style.textContent = `@keyframes gm-rainbow { from { background-position: 0 0; } to { background-position: -1000px 0; } }`;
    document.head.appendChild(style);
    rainbowStyleInjected = true;
  }

  function applyCourseColor(el, score) {
    if (score === null) return;
    if (typeof score === "number" && score > 99.995) {
      ensureRainbowKeyframes();
      el.classList.add("rainbow-moving");
      el.style.removeProperty("background");
      el.style.animation = "gm-rainbow 5s linear infinite";
    } else {
      el.classList.remove("rainbow-moving");
      el.style.removeProperty("animation");
      let g = getGradient(score, isGPAColorMode);
      el.style.background = g.bg;
    }
  }

  // 智能寻找总结栏（兼容电脑版、手机版以及已经处理过的情况）
  function findBottomBlock() {
    let processed = document.querySelector('.semester-block[data-gm-overall="1"]');
    if (processed) return processed;

    let bottom = document.querySelector(".semester-block-bottom");
    if (bottom) return bottom;

    let blocks = document.querySelectorAll(".semester-block");
    for (let block of blocks) {
      if (block.textContent.includes("总学分") && !block.querySelector(".course-row")) {
        return block;
      }
    }
    return null;
  }

  function processSemesterBlock(block) {
    if (block.dataset.gmProcessed) return;

    let titleRow = block.querySelector(":scope > div:first-child .layout-row");
    let courseRowEls = Array.from(block.querySelectorAll(".course-row"));
    if (!titleRow || courseRowEls.length === 0) return;

    courseRowEls.forEach(el => { if (!el.dataset.gmOrder) el.dataset.gmOrder = gmOrderCounter++; });

    let courseData = courseRowEls.map((el, index) => {
      let row = el.querySelector(".layout-row");
      return {
        el, row,
        credit: getCreditFromRow(row),
        score: getScoreFromRow(row),
        details: getDetailsFromRow(row),
        origIndex: index,
      };
    });

    let sorted = sortCourses(courseData);
    let container = courseRowEls[0].parentElement;
    sorted.forEach(c => container.appendChild(c.el));

    sorted.forEach(c => {
      applyCourseColor(c.row, c.score);

      let rightDiv = c.row.querySelector(".layout-row-right .layout-vertical");
      if (rightDiv) {
        let upDiv = rightDiv.querySelector(".layout-vertical-up");
        let downDiv = rightDiv.querySelector(".layout-vertical-down");
        if (!downDiv) {
          downDiv = document.createElement("div");
          downDiv.className = "layout-vertical-down";
          if (upDiv) Array.from(upDiv.attributes).forEach(attr => { if (attr.name.startsWith("data-v-")) downDiv.setAttribute(attr.name, attr.value); });
          rightDiv.appendChild(downDiv);
        }
        if (upDiv) upDiv.textContent = getScoreDisplay(c.score);
        downDiv.textContent = getGPADisplay(c.score);
      }

      let detailsDiv = c.row.querySelector(".layout-row-middle .layout-vertical-down");
      if (detailsDiv && !detailsDiv.dataset.gmSet) {
        let courseType = c.details;
        let rawTeacher = getTeacherFromExtras(c.row);
        let teacherStr = parseTeacherInfo(rawTeacher);
        detailsDiv.textContent = courseType + " - " + teacherStr;
        detailsDiv.dataset.gmSet = "1";
      }
    });

    // 计算当前学期平均值
    let avgGPA, avg100;
    if (isAverageScoreMode) {
      let avgScore = calcWeightedScore(courseData);
      avgGPA = avgScore !== null ? scoreToGPA(avgScore) : null;
      avg100 = avgScore;
    } else {
      avgGPA = calcWeightedGPA(courseData);
      avg100 = gpaTo100(avgGPA);
    }

    let avgColorScore = isAverageScoreMode ? avg100 : gpaTo100(avgGPA);
    titleRow.style.backgroundColor = getTitleColor(avgColorScore, isGPAColorMode);
    let titleMiddle = titleRow.querySelector(".layout-row-middle");
    if (titleMiddle) titleMiddle.style.padding = "0";

    if (!titleRow.querySelector(".gm-credit-cell")) {
      let totalCredit = 0;
      courseData.forEach(c => { if (isEffective(c.score)) totalCredit += c.credit; });
      let creditCell = document.createElement("div");
      creditCell.className = "layout-row-left gm-credit-cell";
      creditCell.innerHTML = `<div class="layout-vertical"><div class="layout-vertical-up">${totalCredit}</div><div class="layout-vertical-down">学分</div></div>`;
      titleRow.insertBefore(creditCell, titleRow.firstChild);
    }

    let titleMiddleDiv = titleRow.querySelector(".layout-row-middle .layout-vertical");
    if (titleMiddleDiv) {
      let downDiv = titleMiddleDiv.querySelector(".layout-vertical-down");
      if (downDiv && !downDiv.dataset.gmSet) {
        downDiv.textContent = `共 ${courseData.length} 门课程`;
        downDiv.dataset.gmSet = "1";
      }
    }

    let titleRightDiv = titleRow.querySelector(".layout-row-right .layout-vertical");
    if (titleRightDiv) {
      let upDiv = titleRightDiv.querySelector(".layout-vertical-up");
      let downDiv = titleRightDiv.querySelector(".layout-vertical-down");
      if (!upDiv) {
        upDiv = document.createElement("div");
        upDiv.className = "layout-vertical-up";
        if (downDiv) Array.from(downDiv.attributes).forEach(attr => { if (attr.name.startsWith("data-v-")) downDiv.setAttribute(attr.name, attr.value); });
        titleRightDiv.insertBefore(upDiv, titleRightDiv.firstChild);
      }
      if (!downDiv) {
        downDiv = document.createElement("div");
        downDiv.className = "layout-vertical-down";
        if (upDiv) Array.from(upDiv.attributes).forEach(attr => { if (attr.name.startsWith("data-v-")) downDiv.setAttribute(attr.name, attr.value); });
        titleRightDiv.appendChild(downDiv);
      }

      let displayGPA = upDiv.dataset.gmOriginalText;
      if (displayGPA === undefined) {
        displayGPA = upDiv.textContent.trim();
        upDiv.dataset.gmOriginalText = displayGPA;
      }

      if (isAverageScoreMode) {
        // 平均分模式下：学期平均分保留 2 位小数，学期绩点保留 3 位小数
        upDiv.textContent = avg100 !== null ? avg100.toFixed(2) : "-.--";
        downDiv.textContent = avgGPA !== null ? avgGPA.toFixed(3) : "-.--";
      } else {
        if (displayGPA === "-.--" || !displayGPA) {
          displayGPA = avgGPA !== null ? avgGPA.toFixed(2) : "-.--";
        }
        upDiv.textContent = displayGPA;
        downDiv.textContent = avg100 !== null ? formatNumber(avg100, 1) : "-.--";
      }
    }

    block.dataset.gmProcessed = "1";
  }

  function buildVertical(upText, downText, dv) {
    let v = applyDataVAttrs(document.createElement("div"), dv);
    v.className = "layout-vertical";
    let upDiv = applyDataVAttrs(document.createElement("div"), dv);
    upDiv.className = "layout-vertical-up";
    upDiv.textContent = upText;
    let downDiv = applyDataVAttrs(document.createElement("div"), dv);
    downDiv.className = "layout-vertical-down";
    downDiv.textContent = downText;
    v.appendChild(upDiv);
    v.appendChild(downDiv);
    return v;
  }

  function processBottomBlock(bottomBlock) {
    if (bottomBlock.dataset.gmProcessed) return;

    bottomBlock.className = "semester-block";

    let dv = getDataVAttrs(document.querySelector(".semester-block") || document.querySelector(".viewer"));
    if (!dv.length) {
      let elWithDv = document.querySelector("[data-v-36f190d7]") || document.querySelector("[data-v-a949b23e]") || document.querySelector("[data-v]");
      if (elWithDv) dv = getDataVAttrs(elWithDv);
    }

    let officialCredit = bottomBlock.dataset.gmOfficialCredit || null;
    let officialGPA = bottomBlock.dataset.gmOfficialGPA || null;
    if (!officialCredit || !officialGPA) {
      let rows = bottomBlock.querySelectorAll(".semester-block-row");
      rows.forEach(row => {
        let labels = row.querySelectorAll(".block-row-label");
        if (labels.length >= 2) {
          if (labels[0].textContent.trim() === "总学分") {
            officialCredit = labels[1].textContent.trim();
            bottomBlock.dataset.gmOfficialCredit = officialCredit;
          } else if (labels[0].textContent.trim() === "总绩点") {
            officialGPA = labels[1].textContent.trim();
            bottomBlock.dataset.gmOfficialGPA = officialGPA;
          }
        }
      });
    }

    let courses = [];
    document.querySelectorAll(".semester-block").forEach(sb => {
      if (sb.dataset.gmOverall === "1") return;

      sb.querySelectorAll(".course-row").forEach(el => {
        if (!el.dataset.gmOrder) el.dataset.gmOrder = gmOrderCounter++;
        let row = el.querySelector(".layout-row");
        if (!row) return;
        courses.push({
          order: parseInt(el.dataset.gmOrder, 10) || 0,
          credit: getCreditFromRow(row),
          score: getScoreFromRow(row),
          type: getCourseTypeFromRow(row),
          name: getCourseNameFromRow(row),
        });
      });
    });
    courses.sort((a, b) => a.order - b.order);

    let totalCredit = 0;
    courses.forEach(c => { if (isEffective(c.score)) totalCredit += c.credit; });

    let overallGPA, overall100, overall100Color, overall100Text;
    if (isAverageScoreMode) {
      let overallWeightedScore = calcWeightedScore(courses);
      overall100 = overallWeightedScore;
      overallGPA = overall100 !== null ? scoreToGPA(overall100) : null;
      overall100Color = typeof overall100 === "number" ? overall100 : null;
    } else {
      overallGPA = calcWeightedGPA(courses);
      let overall100Disp = gpaTo100Display(overallGPA);
      overall100 = overall100Disp;
      overall100Color = typeof overall100 === "number" ? overall100 : null;
      overall100Text = typeof overall100 === "number" ? formatNumber(overall100, 1) : overall100;
    }

    bottomBlock.innerHTML = "";

    // 标题行
    let titleWrapper = applyDataVAttrs(document.createElement("div"), dv);
    let titleRow = applyDataVAttrs(document.createElement("div"), dv);
    titleRow.className = "layout-row";
    titleRow.style.backgroundColor = getTitleColor(overall100Color, isGPAColorMode);

    let leftCell = applyDataVAttrs(document.createElement("div"), dv);
    leftCell.className = "layout-row-left gm-credit-cell";
    let leftVert = applyDataVAttrs(document.createElement("div"), dv);
    leftVert.className = "layout-vertical";
    let leftUp = applyDataVAttrs(document.createElement("div"), dv);
    leftUp.className = "layout-vertical-up";
    leftUp.textContent = isAverageScoreMode ? totalCredit : formatNumber(totalCredit, 1);
    let leftDown = applyDataVAttrs(document.createElement("div"), dv);
    leftDown.className = "layout-vertical-down";
    leftDown.textContent = "学分";
    leftVert.appendChild(leftUp);
    leftVert.appendChild(leftDown);
    leftCell.appendChild(leftVert);

    let middleCell = applyDataVAttrs(document.createElement("div"), dv);
    middleCell.className = "layout-row-middle";
    middleCell.style.padding = "0";
    let middleVert = applyDataVAttrs(document.createElement("div"), dv);
    middleVert.className = "layout-vertical ml-20";
    let middleUp = applyDataVAttrs(document.createElement("div"), dv);
    middleUp.className = "layout-vertical-up";
    let middleDown = applyDataVAttrs(document.createElement("div"), dv);
    middleDown.className = "layout-vertical-down";
    let effectiveCourseCount = courses.filter(c => isEffective(c.score)).length;

    let rightCell = applyDataVAttrs(document.createElement("div"), dv);
    rightCell.className = "layout-row-right";
    let rightVert = applyDataVAttrs(document.createElement("div"), dv);
    rightVert.className = "layout-vertical mr-20";
    let rightUp = applyDataVAttrs(document.createElement("div"), dv);
    rightUp.className = "layout-vertical-up";
    let rightDown = applyDataVAttrs(document.createElement("div"), dv);
    rightDown.className = "layout-vertical-down";

    if (isAverageScoreMode) {
      middleUp.textContent = "平均分";
      middleDown.textContent = `共 ${effectiveCourseCount} 门课程`;

      // 平均分模式下：总平均分保留 2 位小数，总绩点保留 3 位小数
      rightUp.textContent = overall100 !== null ? overall100.toFixed(2) : "-.--";
      rightDown.textContent = overallGPA !== null ? overallGPA.toFixed(3) : "-.--";
    } else {
      middleUp.textContent = "总绩点";
      let gpaText = officialGPA?.trim() || (overallGPA !== null ? overallGPA.toFixed(2) : "-.--");
      if (!gpaText) gpaText = "-.--";
      middleDown.textContent = `共 ${effectiveCourseCount} 门课程，官方 GPA：${gpaText}`;

      rightUp.textContent = gpaText;
      rightDown.textContent = overall100Text;
    }

    middleVert.appendChild(middleUp);
    middleVert.appendChild(middleDown);
    middleCell.appendChild(middleVert);

    rightVert.appendChild(rightUp);
    rightVert.appendChild(rightDown);
    rightCell.appendChild(rightVert);

    titleRow.appendChild(leftCell);
    titleRow.appendChild(middleCell);
    titleRow.appendChild(rightCell);
    titleWrapper.appendChild(titleRow);
    bottomBlock.appendChild(titleWrapper);

    // 按类型分组
    let byType = new Map();
    courses.forEach(c => {
      let k = c.type || "";
      let arr = byType.get(k);
      if (!arr) byType.set(k, (arr = []));
      arr.push(c);
    });

    let overallRows = [];
    byType.forEach((arr, title) => {
      let totalCreditForCount = 0;
      let effectiveCount = 0;
      let data = [];

      let scoreWeightedSum = 0;
      let scoreCreditSum = 0;

      let gpaWeightedSum = 0;
      let gpaCreditSum = 0;

      arr.forEach(c => {
        if (isEffective(c.score)) {
          totalCreditForCount += c.credit;
          effectiveCount++;

          // 学分加权百分制成绩
          if (typeof c.score === "number") {
            scoreWeightedSum += c.score * c.credit;
            scoreCreditSum += c.credit;
          }

          // 学分加权绩点
          let g = scoreToGPA(c.score);
          if (g !== null) {
            gpaWeightedSum += g * c.credit;
            gpaCreditSum += c.credit;
          }
        }
        data.push({
          left: `${formatNumber(c.credit, 1)}学分`,
          right: `${c.name} - ${getScoreDisplay(c.score)}`,
        });
      });

      // 计算分组后的加权平均值（无适用分数时，返回 NaN 以便触发灰蓝色背景渲染）
      let weightedScore = scoreCreditSum > 0 ? scoreWeightedSum / scoreCreditSum : NaN;
      let weightedGPA = gpaCreditSum > 0 ? gpaWeightedSum / gpaCreditSum : NaN;

      if (isAverageScoreMode) {
        // 平均分模式下：分项加权平均分保留 2 位小数
        let displayScore = !isNaN(weightedScore) ? weightedScore.toFixed(2) : "-.--";
        overallRows.push({
          title, title_xf: formatNumber(totalCreditForCount, 1),
          class: `共 ${effectiveCount} 门课程`,
          displayScore: displayScore,
          scoreValue: weightedScore, // 100分制加权分用于背景色渐变
          weightedGPA: weightedGPA,
          data,
        });
      } else {
        // 绩点为主模式下：分项加权平均绩点保留 2 位小数
        let displayGPA = !isNaN(weightedGPA) ? weightedGPA.toFixed(2) : "-.--";
        overallRows.push({
          title, title_xf: formatNumber(totalCreditForCount, 1),
          class: `共 ${effectiveCount} 门课程`,
          displayGPA: displayGPA,
          // 绩点模式下，用于着色的 scoreValue 切换为加权绩点反折算回的分数（无有效绩点时传入 NaN 保持灰色）
          scoreValue: isNaN(weightedGPA) ? NaN : gpaTo100(weightedGPA),
          weightedGPA: weightedGPA,
          data,
        });
      }
    });

    // 优化后的安全排序（防止 NaN 破坏排序）
    if (isAverageScoreMode) {
      overallRows.sort((a, b) => {
        let valA = parseFloat(a.displayScore), valB = parseFloat(b.displayScore);
        if (isNaN(valA)) return 1;
        if (isNaN(valB)) return -1;
        return valB - valA;
      });
    } else {
      overallRows.sort((a, b) => {
        let valA = parseFloat(a.displayGPA), valB = parseFloat(b.displayGPA);
        if (isNaN(valA)) return 1;
        if (isNaN(valB)) return -1;
        return valB - valA;
      });
    }

    overallRows.forEach(r => {
      let wrap = applyDataVAttrs(document.createElement("div"), dv);
      let row = applyDataVAttrs(document.createElement("div"), dv);
      row.className = "layout-row course-row";
      row.dataset.gmScore = String(r.scoreValue);
      applyCourseColor(row, r.scoreValue); // 此时会严格根据对应模式的 scoreValue 渲染背景色

      let extra = applyDataVAttrs(document.createElement("div"), dv);
      extra.className = "layout-vertical-extra layout-vertical-extra-show";
      extra.style.display = "none";
      let extraInner = applyDataVAttrs(document.createElement("div"), dv);
      r.data.forEach(d => {
        let p = applyDataVAttrs(document.createElement("p"), dv);
        let b = applyDataVAttrs(document.createElement("b"), dv);
        b.textContent = d.left + " - ";
        p.appendChild(b);
        p.appendChild(document.createTextNode(d.right));
        extraInner.appendChild(p);
      });
      extra.appendChild(extraInner);

      row.onclick = () => { extra.style.display = extra.style.display === "none" ? "" : "none"; };

      let l = applyDataVAttrs(document.createElement("div"), dv);
      l.className = "layout-row-left";
      l.appendChild(buildVertical(r.title_xf, "学分", dv));

      let m = applyDataVAttrs(document.createElement("div"), dv);
      m.className = "layout-row-middle";
      let mv = applyDataVAttrs(document.createElement("div"), dv);
      mv.className = "layout-vertical";
      let mu = applyDataVAttrs(document.createElement("div"), dv);
      mu.className = "layout-vertical-up";
      let span = applyDataVAttrs(document.createElement("span"), dv);
      let badge = applyDataVAttrs(document.createElement("span"), dv);
      badge.className = "prevent-click-handler course-badge course-badge-primary";
      let icon = applyDataVAttrs(document.createElement("span"), dv);
      icon.className = "icon icon-share";
      badge.appendChild(icon);
      span.appendChild(badge);
      span.appendChild(document.createTextNode(r.title));
      mu.appendChild(span);
      let md = applyDataVAttrs(document.createElement("div"), dv);
      md.className = "layout-vertical-down";
      md.textContent = r.class;
      mv.appendChild(mu);
      mv.appendChild(md);
      mv.appendChild(extra);
      m.appendChild(mv);

      let rr = applyDataVAttrs(document.createElement("div"), dv);
      rr.className = "layout-row-right";

      if (isAverageScoreMode) {
        // 【平均分为主模式】大字显示：加权平均分；小字显示：该加权平均分对应的绩点（公式转换，保留3位）
        let typeGPA = (!isNaN(r.scoreValue) && r.scoreValue !== null) ? scoreToGPA(r.scoreValue) : null;
        let gpaStr = typeGPA !== null ? typeGPA.toFixed(3) : "-.--";
        rr.appendChild(buildVertical(r.displayScore, gpaStr, dv));
      } else {
        // 【绩点为主模式】大字显示：加权平均绩点；小字显示：该绩点对应的百分制分数（公式转换，保留1位）
        let typeScore = (!isNaN(r.weightedGPA) && r.weightedGPA !== null) ? gpaTo100(r.weightedGPA) : null;
        let scoreStr = typeScore !== null ? formatNumber(typeScore, 1) : "-.--";
        rr.appendChild(buildVertical(r.displayGPA, scoreStr, dv));
      }

      row.appendChild(l);
      row.appendChild(m);
      row.appendChild(rr);
      wrap.appendChild(row);
      bottomBlock.appendChild(wrap);
    });

    bottomBlock.dataset.gmOverall = "1";
    if (overall100Color !== null) bottomBlock.dataset.gmOverallScore = String(overall100Color);
    bottomBlock.dataset.gmProcessed = "1";
  }

  function processPage() {
    let bottomBlock = findBottomBlock();

    document.querySelectorAll(".semester-block").forEach(block => {
      if (block === bottomBlock) return;
      processSemesterBlock(block);
    });

    if (bottomBlock) processBottomBlock(bottomBlock);
  }

  function updateColors() {
    document.querySelectorAll(".semester-block").forEach(block => {
      let titleRow = block.querySelector(":scope > :first-child .layout-row");
      if (!titleRow) return;
      if (block.dataset.gmOverall === "1") {
        let s = parseFloat(block.dataset.gmOverallScore || "");
        titleRow.style.backgroundColor = getTitleColor(isNaN(s) ? null : s, isGPAColorMode);
        block.querySelectorAll(".layout-row.course-row").forEach(row => {
          let v = parseFloat(row.dataset.gmScore || "");
          if (!isNaN(v)) applyCourseColor(row, v);
        });
        return;
      }
      let courseData = [];
      block.querySelectorAll(".course-row .layout-row").forEach(row => {
        let score = getScoreFromRow(row);
        applyCourseColor(row, score);
        courseData.push({ credit: getCreditFromRow(row), score });
      });
      let avgColorScore;
      if (isAverageScoreMode) {
        avgColorScore = calcWeightedScore(courseData);
      } else {
        let avgGPA = calcWeightedGPA(courseData);
        avgColorScore = gpaTo100(avgGPA);
      }
      titleRow.style.backgroundColor = getTitleColor(avgColorScore, isGPAColorMode);
    });
  }

  function addControlToggles() {
    let controllerBar = document.querySelector(".controller-bar");
    if (!controllerBar) return;

    let nativeLink = controllerBar.querySelector("a");
    let dv = nativeLink ? getDataVAttrs(nativeLink) : [];

    // 1. 着色模式切换按钮
    if (!document.getElementById("gm-color-toggle")) {
      let toggle = document.createElement("a");
      toggle.id = "gm-color-toggle";
      toggle.innerHTML = isGPAColorMode ? '<span class="icon icon-display"></span> 切换为百分制着色' : '<span class="icon icon-display"></span> 切换为四分制着色';
      toggle.title = isGPAColorMode ? "当前四分制着色，GPA从1至4由红变绿" : "当前百分制着色，分数从60至100由红变绿";
      applyDataVAttrs(toggle, dv);

      toggle.onclick = () => {
        isGPAColorMode = !isGPAColorMode;
        resetProcessedStates();
        processPage();
        toggle.innerHTML = isGPAColorMode ? '<span class="icon icon-display"></span> 切换为百分制着色' : '<span class="icon icon-display"></span> 切换为四分制着色';
        toggle.title = isGPAColorMode ? "当前四分制着色，GPA从1至4由红变绿" : "当前百分制着色，分数从60至100由红变绿";
      };
      controllerBar.appendChild(toggle);
    }

    // 2. 主显模式（绩点/平均分）切换按钮
    if (!document.getElementById("gm-mode-toggle")) {
      let toggleMode = document.createElement("a");
      toggleMode.id = "gm-mode-toggle";
      toggleMode.style.marginLeft = "0.8em";
      toggleMode.innerHTML = isAverageScoreMode ? '<span class="icon icon-bookmarks"></span> 切换至绩点为主' : '<span class="icon icon-bookmarks"></span> 切换至平均分为主';
      toggleMode.title = isAverageScoreMode ? "当前以平均分为主" : "当前以绩点为主，包含官方GPA";
      applyDataVAttrs(toggleMode, dv);

      toggleMode.onclick = () => {
        isAverageScoreMode = !isAverageScoreMode;
        resetProcessedStates();
        processPage();
        toggleMode.innerHTML = isAverageScoreMode ? '<span class="icon icon-bookmarks"></span> 切换至绩点为主' : '<span class="icon icon-bookmarks"></span> 切换至平均分为主';
        toggleMode.title = isAverageScoreMode ? "当前以平均分为主" : "当前以绩点为主，包含官方GPA";
      };
      controllerBar.appendChild(toggleMode);
    }
  }

  function resetProcessedStates() {
    document.querySelectorAll(".semester-block").forEach(b => {
      delete b.dataset.gmProcessed;
    });
    let bottom = findBottomBlock();
    if (bottom) delete bottom.dataset.gmProcessed;
  }

  function updateControllerBarTip() {
    let tip = document.querySelector(".controller-bar-tip");
    if (tip && !tip.dataset.gmSet) {
      let origText = tip.textContent.trim();
      tip.innerHTML = origText + `<br>绩点公式：GPA(x) = 4-3*(100-x)<sup>2</sup>/1600`;
      tip.dataset.gmSet = "1";
    }
  }

  function init() {
    if (document.querySelector(".viewer")) {
      processPage();
      addControlToggles();
      updateControllerBarTip();
    }
  }

  let observer = new MutationObserver(mutations => {
    if (mutations.some(m => m.type === "childList" && m.addedNodes.length > 0)) {
      setTimeout(init, 100);
    }
  });
  if (document.body) observer.observe(document.body, { childList: true, subtree: true });
  else document.addEventListener("DOMContentLoaded", () => observer.observe(document.body, { childList: true, subtree: true }));

  setInterval(() => { if (document.querySelector(".viewer") && !document.getElementById("gm-color-toggle")) init(); }, 1000);

  function forceBackground() {
    let main = document.querySelector(".main");
    if (main) main.style.setProperty("background-color", "#333", "important");
  }
  if (document.body) forceBackground();
  document.addEventListener("DOMContentLoaded", forceBackground);
  window.addEventListener("load", forceBackground);
  setInterval(forceBackground, 500);
})();