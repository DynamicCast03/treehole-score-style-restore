// ==UserScript==
// @name         PKU树洞成绩查询样式恢复
// @namespace    http://tampermonkey.net/
// @version      3.0
// @description  恢复PKU树洞成绩查询页面的原始样式
// @author       Restored
// @match        *://treehole.pku.edu.cn/*
// @match        *://pkuhelper.pku.edu.cn/*
// @grant        GM_addStyle
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    const GRADE_MAP = {
        'P': null, 'NP': null, 'EX': null, 'IP': null, 'I': null, 'W': null,
        'A+': 4, 'A': 4, 'A-': 3.7, 'B+': 3.3, 'B': 3, 'B-': 2.7,
        'C+': 2.3, 'C': 2, 'C-': 1.7, 'D+': 1.3, 'D': 1, 'F': null
    };

    const SPECIAL_TEXT = {
        'P': '通过', 'NP': '未通过', 'EX': '免修',
        'IP': '跨学期', 'I': '缓考', 'W': '退课'
    };

    function scoreToGPA(score) {
        if (score === null || score === undefined) return null;
        if (typeof score === 'string') {
            if (GRADE_MAP.hasOwnProperty(score)) return GRADE_MAP[score];
            let n = parseFloat(score);
            if (!isNaN(n)) score = n;
            else return null;
        }
        return score >= 60 ? 4 - 3 * Math.pow(100 - score, 2) / 1600 : null;
    }

    function gpaTo100(gpa) {
        if (gpa === null) return null;
        if (gpa >= 4) return 100;
        if (gpa >= 1) return (-40 * Math.sqrt(3) * Math.sqrt(4 - gpa) + 300) / 3;
        return null;
    }

    function calcRatio(score, useGPA) {
        let gpa = scoreToGPA(score);
        if (gpa === null) return 0;
        if (useGPA) return (gpa - 1) / 3;
        let s100 = gpaTo100(gpa);
        return (s100 - 60) / 40;
    }

    function isNull(score) {
        return scoreToGPA(score) === null;
    }

    function isFail(score) {
        return score === 'NP' || score === 'F' || (typeof score === 'number' && score < 60);
    }

    function getTitleColor(score, useGPA) {
        if (isNull(score)) return 'hsl(240,30%,88%)';
        return `hsl(${120 * calcRatio(score, useGPA)},${useGPA ? 97 : 100}%,70%)`;
    }

    function getGradient(score, useGPA) {
        if (isNull(score) || (typeof score === 'number' && score < 60)) {
            return { bg: 'hsl(240,30%,88%)', ratio: isFail(score) ? 0 : 1 };
        }
        let r = calcRatio(score, useGPA);
        let c1 = `hsl(${120*r},${useGPA?97:100}%,75%)`;
        let c2 = `hsl(${120*r},${useGPA?97:100}%,70%)`;
        let c3 = `hsl(${120*r},${useGPA?57:60}%,65%)`;
        let pct = Math.max(r, 0.01) * 100 + '%';
        return { bg: `linear-gradient(to right, ${c1}, ${c2} ${pct}, ${c3} ${pct})`, ratio: r };
    }

    function formatNumber(n, decimals) {
        if (typeof n !== 'number') return n;
        return n.toFixed(decimals).replace(/\.?0+$/, '');
    }

    function getGPADisplay(score) {
        let gpa = scoreToGPA(score);
        if (gpa !== null) return gpa.toFixed(2);
        if (typeof score === 'string' && SPECIAL_TEXT[score]) return SPECIAL_TEXT[score];
        return '-.--';
    }

    function getScoreDisplay(score) {
        if (typeof score === 'number') return formatNumber(score, 1);
        return score || '-.--';
    }

    GM_addStyle(`
        .container { color: #fff !important; }
        .controller-bar { color: #add8e6 !important; }
        .controller-bar a { color: #add8e6 !important; cursor: pointer; }
        .controller-bar.new-color a { color: #add8e6 !important; }
        .osu-text { color: #fff !important; }
        .footer { color: #add8e6 !important; text-align: center !important; margin: 2rem 0; padding-bottom: 3rem; }
        .footer p { color: #add8e6 !important; }
        .controller-bar-tip { color: #add8e6 !important; text-align: center !important; }

        .semester-block > :first-child {
            box-shadow: 0 0 6px rgba(0,0,0,.8) !important;
            border: none !important;
        }
        .semester-block > :first-child .layout-row {
            padding-top: 0.25em !important;
            padding-bottom: 0.25em !important;
        }
        .course-row {
            box-shadow: 0 -1px 0 #7f7f7f !important;
            border: none !important;
        }

        .rainbow-moving {
            background: linear-gradient(-45deg,#c5fcc5,#ffd1d1,#d1d1ff,#c5fcc5,#ffd1d1,#d1d1ff,#c5fcc5,#ffd1d1,#d1d1ff,#c5fcc5,#ffd1d1,#d1d1ff,#c5fcc5) 0 0 !important;
            background-size: 1800px 200px !important;
        }

        #gm-color-toggle { margin-left: 0.8em; cursor: pointer; }

        .gm-credit-cell {
            flex: 0 0 2.5em; text-align: center;
        }
        .gm-credit-cell .layout-vertical-up { font-size: 1em; }
        .gm-credit-cell .layout-vertical-down { font-size: 60%; }
    `);

    let useGPAMode = false;

    function parseScore(text) {
        if (!text) return null;
        text = text.trim();
        if (GRADE_MAP.hasOwnProperty(text)) return text;
        if (SPECIAL_TEXT.hasOwnProperty(text)) {
            for (let k in SPECIAL_TEXT) {
                if (SPECIAL_TEXT[k] === text) return k;
            }
        }
        let n = parseFloat(text);
        return isNaN(n) ? text : n;
    }

    function getCreditFromRow(row) {
        let leftDiv = row.querySelector('.layout-row-left .layout-vertical-up');
        if (leftDiv) return parseFloat(leftDiv.textContent) || 0;
        return 0;
    }

    function getScoreFromRow(row) {
        let rightDiv = row.querySelector('.layout-row-right .layout-vertical-up');
        if (rightDiv) return parseScore(rightDiv.textContent);
        return null;
    }

    function getDetailsFromRow(row) {
        let detailsDiv = row.querySelector('.layout-row-middle .layout-vertical-down');
        if (detailsDiv) return detailsDiv.textContent.trim();
        return '';
    }

    function parseTeacherInfo(rawTeacher) {
        if (!rawTeacher) return '（无教师信息）';
        let parts = rawTeacher.split(',');
        let first = parts[0];
        let match = /^[^-]+-([^$]+)\$([^$]*)\$([^$]*)$/.exec(first);
        if (match) {
            let name = match[1];
            let org = match[2];
            let suffix = parts.length > 1 ? `等${parts.length}人` : '';
            return `${name}（${org}）${suffix}`;
        }
        return first + (parts.length > 1 ? ` 等${parts.length}人` : '');
    }

    function getTeacherFromExtras(row) {
        let extraDiv = row.querySelector('.layout-vertical-extra');
        if (!extraDiv) return null;
        let ps = extraDiv.querySelectorAll('p');
        for (let p of ps) {
            let b = p.querySelector('b');
            if (b && b.textContent.includes('教师信息')) {
                let span = p.querySelector('span');
                if (span) return span.textContent.trim();
            }
        }
        return null;
    }

    function getCourseTypeFromRow(row) {
        let detailsDiv = row.querySelector('.layout-row-middle .layout-vertical-down');
        if (detailsDiv) return detailsDiv.textContent.trim();
        return '';
    }

    function calcWeightedGPA(courseData) {
        let totalCredit = 0, totalWeighted = 0;
        courseData.forEach(c => {
            let gpa = scoreToGPA(c.score);
            if (gpa !== null && c.credit > 0) {
                totalCredit += c.credit;
                totalWeighted += c.credit * gpa;
            }
        });
        return totalCredit > 0 ? totalWeighted / totalCredit : null;
    }

    function sortCourses(courseData) {
        return courseData.slice().sort((a, b) => {
            let gpaA = scoreToGPA(a.score);
            let gpaB = scoreToGPA(b.score);
            if (gpaA !== gpaB) {
                if (gpaB === null) return -1;
                if (gpaA === null) return 1;
                return gpaB - gpaA;
            }
            let failA = isFail(a.score) ? 1 : 0;
            let failB = isFail(b.score) ? 1 : 0;
            if (failA !== failB) return failA - failB;
            return b.origIndex - a.origIndex;
        });
    }

    let rainbowStyleInjected = false;
    function ensureRainbowKeyframes() {
        if (rainbowStyleInjected) return;
        let style = document.createElement('style');
        style.textContent = `
            @keyframes gm-rainbow {
                from { background-position: 0 0; }
                to { background-position: -1000px 0; }
            }
        `;
        document.head.appendChild(style);
        rainbowStyleInjected = true;
    }

    function applyCourseColor(el, score) {
        if (score === null) return;
        if (typeof score === 'number' && score > 99.995) {
            ensureRainbowKeyframes();
            el.classList.add('rainbow-moving');
            el.style.removeProperty('background');
            el.style.animation = 'gm-rainbow 5s linear infinite';
        } else {
            el.classList.remove('rainbow-moving');
            el.style.removeProperty('animation');
            let g = getGradient(score, useGPAMode);
            el.style.background = g.bg;
        }
    }

    function isOverallBlock(block) {
        let titleUp = block.querySelector('.layout-row-middle .layout-vertical-up');
        if (!titleUp) return false;
        let text = titleUp.textContent.trim();
        return text === '总绩点' || text === '总学分';
    }

    function processSemesterBlock(block) {
        if (block.dataset.gmProcessed) return;

        let titleRow = block.querySelector(':scope > div:first-child .layout-row');
        let courseRowEls = Array.from(block.querySelectorAll('.course-row'));
        if (!titleRow) return;
        if (courseRowEls.length === 0) {
            if (isOverallBlock(block)) {
                processOverallBlock(block);
            }
            return;
        }

        let courseData = courseRowEls.map((el, index) => {
            let row = el.querySelector('.layout-row');
            return {
                el: el,
                row: row,
                credit: getCreditFromRow(row),
                score: getScoreFromRow(row),
                details: getDetailsFromRow(row),
                origIndex: index
            };
        });

        let sorted = sortCourses(courseData);
        let container = courseRowEls[0].parentElement;
        sorted.forEach(c => container.appendChild(c.el));

        sorted.forEach(c => {
            applyCourseColor(c.row, c.score);

            let rightDiv = c.row.querySelector('.layout-row-right .layout-vertical');
            if (rightDiv) {
                let upDiv = rightDiv.querySelector('.layout-vertical-up');
                let downDiv = rightDiv.querySelector('.layout-vertical-down');
                if (!downDiv) {
                    downDiv = document.createElement('div');
                    downDiv.className = 'layout-vertical-down';
                    if (upDiv) {
                        Array.from(upDiv.attributes).forEach(attr => {
                            if (attr.name.startsWith('data-v-')) downDiv.setAttribute(attr.name, attr.value);
                        });
                    }
                    rightDiv.appendChild(downDiv);
                }
                if (upDiv) upDiv.textContent = getScoreDisplay(c.score);
                downDiv.textContent = getGPADisplay(c.score);
            }

            let detailsDiv = c.row.querySelector('.layout-row-middle .layout-vertical-down');
            if (detailsDiv && !detailsDiv.dataset.gmSet) {
                let courseType = c.details;
                let rawTeacher = getTeacherFromExtras(c.row);
                let teacherStr = parseTeacherInfo(rawTeacher);
                detailsDiv.textContent = courseType + ' - ' + teacherStr;
                detailsDiv.dataset.gmSet = '1';
            }
        });

        let avgGPA = calcWeightedGPA(courseData);
        let avg100 = gpaTo100(avgGPA);
        titleRow.style.backgroundColor = getTitleColor(avg100, useGPAMode);
        let titleMiddle = titleRow.querySelector('.layout-row-middle');
        if (titleMiddle) titleMiddle.style.padding = '0';

        if (!titleRow.querySelector('.gm-credit-cell')) {
            let totalCredit = 0;
            courseData.forEach(c => {
                if (c.score !== 'W' && c.score !== 'I') totalCredit += c.credit;
            });
            let creditCell = document.createElement('div');
            creditCell.className = 'layout-row-left gm-credit-cell';
            creditCell.innerHTML = `
                <div class="layout-vertical">
                    <div class="layout-vertical-up">${totalCredit}</div>
                    <div class="layout-vertical-down">学分</div>
                </div>
            `;
            titleRow.insertBefore(creditCell, titleRow.firstChild);
        }

        let titleMiddleDiv = titleRow.querySelector('.layout-row-middle .layout-vertical');
        if (titleMiddleDiv) {
            let downDiv = titleMiddleDiv.querySelector('.layout-vertical-down');
            if (downDiv && !downDiv.dataset.gmSet) {
                downDiv.textContent = `共 ${courseData.length} 门课程`;
                downDiv.dataset.gmSet = '1';
            }
        }

        let titleRightDiv = titleRow.querySelector('.layout-row-right .layout-vertical');
        if (titleRightDiv) {
            let upDiv = titleRightDiv.querySelector('.layout-vertical-up');
            let downDiv = titleRightDiv.querySelector('.layout-vertical-down');
            if (!upDiv) {
                upDiv = document.createElement('div');
                upDiv.className = 'layout-vertical-up';
                if (downDiv) {
                    Array.from(downDiv.attributes).forEach(attr => {
                        if (attr.name.startsWith('data-v-')) upDiv.setAttribute(attr.name, attr.value);
                    });
                }
                titleRightDiv.insertBefore(upDiv, titleRightDiv.firstChild);
            }
            if (!downDiv) {
                downDiv = document.createElement('div');
                downDiv.className = 'layout-vertical-down';
                if (upDiv) {
                    Array.from(upDiv.attributes).forEach(attr => {
                        if (attr.name.startsWith('data-v-')) downDiv.setAttribute(attr.name, attr.value);
                    });
                }
                titleRightDiv.appendChild(downDiv);
            }
            let displayGPA = upDiv.textContent.trim();
            if (displayGPA === '-.--' || !displayGPA) {
                displayGPA = avgGPA !== null ? avgGPA.toFixed(2) : '-.--';
            }
            upDiv.textContent = displayGPA;
            downDiv.textContent = avg100 !== null ? formatNumber(avg100, 1) : '-.--';
        }

        block.dataset.gmProcessed = '1';
    }

    function processOverallBlock(block) {
        if (block.dataset.gmProcessed) return;

        let titleRow = block.querySelector(':scope > div:first-child .layout-row');
        if (!titleRow) return;

        let allCourseData = [];
        document.querySelectorAll('.semester-block').forEach(sb => {
            if (sb === block) return;
            sb.querySelectorAll('.course-row').forEach(el => {
                let row = el.querySelector('.layout-row');
                allCourseData.push({
                    credit: getCreditFromRow(row),
                    score: getScoreFromRow(row)
                });
            });
        });

        let avgGPA = calcWeightedGPA(allCourseData);
        let avg100 = gpaTo100(avgGPA);
        titleRow.style.backgroundColor = getTitleColor(avg100, useGPAMode);
        let titleMiddle = titleRow.querySelector('.layout-row-middle');
        if (titleMiddle) titleMiddle.style.padding = '0';

        if (!titleRow.querySelector('.gm-credit-cell')) {
            let totalCredit = 0;
            allCourseData.forEach(c => {
                let gpa = scoreToGPA(c.score);
                if (gpa !== null || c.score === 'P' || c.score === 'EX') {
                    if (c.score !== 'W') totalCredit += c.credit;
                }
            });
            let creditCell = document.createElement('div');
            creditCell.className = 'layout-row-left gm-credit-cell';
            creditCell.innerHTML = `
                <div class="layout-vertical">
                    <div class="layout-vertical-up">${formatNumber(totalCredit, 1)}</div>
                    <div class="layout-vertical-down">学分</div>
                </div>
            `;
            titleRow.insertBefore(creditCell, titleRow.firstChild);
        }

        let titleRightDiv = titleRow.querySelector('.layout-row-right .layout-vertical');
        if (titleRightDiv) {
            let upDiv = titleRightDiv.querySelector('.layout-vertical-up');
            let downDiv = titleRightDiv.querySelector('.layout-vertical-down');
            if (!downDiv) {
                downDiv = document.createElement('div');
                downDiv.className = 'layout-vertical-down';
                if (upDiv) {
                    Array.from(upDiv.attributes).forEach(attr => {
                        if (attr.name.startsWith('data-v-')) downDiv.setAttribute(attr.name, attr.value);
                    });
                }
                titleRightDiv.appendChild(downDiv);
            }
            downDiv.textContent = avg100 !== null ? formatNumber(avg100, 1) : '-.--';
        }

        block.dataset.gmProcessed = '1';
    }

    function processPage() {
        let semesterBlocks = Array.from(document.querySelectorAll('.semester-block'));
        semesterBlocks.forEach(block => processSemesterBlock(block));
    }

    function updateColors() {
        let semesterBlocks = Array.from(document.querySelectorAll('.semester-block'));
        let allCourseData = [];

        semesterBlocks.forEach(block => {
            block.querySelectorAll('.course-row .layout-row').forEach(row => {
                let score = getScoreFromRow(row);
                applyCourseColor(row, score);
                allCourseData.push({ credit: getCreditFromRow(row), score: score });
            });
        });

        let overallAvgGPA = calcWeightedGPA(allCourseData);
        let overallAvg100 = gpaTo100(overallAvgGPA);

        semesterBlocks.forEach(block => {
            let titleRow = block.querySelector(':scope > div:first-child .layout-row');
            if (!titleRow) return;

            if (isOverallBlock(block)) {
                titleRow.style.backgroundColor = getTitleColor(overallAvg100, useGPAMode);
            } else {
                let courseData = [];
                block.querySelectorAll('.course-row .layout-row').forEach(row => {
                    courseData.push({ credit: getCreditFromRow(row), score: getScoreFromRow(row) });
                });
                let avgGPA = calcWeightedGPA(courseData);
                let avg100 = gpaTo100(avgGPA);
                titleRow.style.backgroundColor = getTitleColor(avg100, useGPAMode);
            }
        });
    }

    function addColorToggle() {
        let controllerBar = document.querySelector('.controller-bar');
        if (!controllerBar || document.getElementById('gm-color-toggle')) return;

        let toggle = document.createElement('a');
        toggle.id = 'gm-color-toggle';
        toggle.innerHTML = '<span class="icon icon-display"></span> 四分制着色';
        toggle.title = '当前百分制着色，分数从60至100由红变绿';
        toggle.onclick = function() {
            useGPAMode = !useGPAMode;
            if (useGPAMode) {
                toggle.innerHTML = '<span class="icon icon-display"></span> 百分制着色';
                toggle.title = '当前四分制着色，GPA从1至4由红变绿';
            } else {
                toggle.innerHTML = '<span class="icon icon-display"></span> 四分制着色';
                toggle.title = '当前百分制着色，分数从60至100由红变绿';
            }
            updateColors();
        };
        controllerBar.appendChild(toggle);
    }

    function restoreFooter() {
        let container = document.querySelector('.container');
        if (!container) return;

        let footer = container.querySelector('.footer');
        if (footer && footer.classList.contains('gm-restored')) return;

        if (!footer) {
            footer = document.createElement('div');
            footer.className = 'footer';
            container.appendChild(footer);
        }

        footer.innerHTML = `
            <p>绩点公式 <a>GPA(x) = 4-3*(100-x)<sup>2</sup>/1600</a></p>
            <br>
            <p>学期GPA和总GPA为公式计算所得，请以学校官方结果为准！</p>
        `;
        footer.classList.add('gm-restored');
    }

    function init() {
        let viewer = document.querySelector('.viewer');
        if (viewer) {
            processPage();
            addColorToggle();
            restoreFooter();
        }
    }

    let observer = new MutationObserver(function(mutations) {
        let shouldProcess = mutations.some(m => {
            if (m.type === 'childList' && m.addedNodes.length > 0) {
                for (let node of m.addedNodes) {
                    if (node.nodeType === 1) {
                        if (node.classList && (
                            node.classList.contains('viewer') ||
                            node.classList.contains('semester-block') ||
                            node.classList.contains('course-row')
                        )) return true;
                        if (node.querySelector && (
                            node.querySelector('.viewer') ||
                            node.querySelector('.semester-block')
                        )) return true;
                    }
                }
            }
            return false;
        });
        if (shouldProcess) setTimeout(init, 100);
    });

    if (document.body) {
        observer.observe(document.body, { childList: true, subtree: true });
    } else {
        document.addEventListener('DOMContentLoaded', function() {
            observer.observe(document.body, { childList: true, subtree: true });
        });
    }

    setInterval(function() {
        if (document.querySelector('.viewer') && !document.getElementById('gm-color-toggle')) init();
    }, 1000);

    function forceBackground() {
        let main = document.querySelector('.main');
        if (main) main.style.setProperty('background-color', '#333', 'important');
    }

    if (document.body) forceBackground();
    document.addEventListener('DOMContentLoaded', forceBackground);
    window.addEventListener('load', forceBackground);
    setInterval(forceBackground, 500);

})();
