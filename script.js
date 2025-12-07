      /**
       * DEM Survey Form Script - Professional & Optimized Version
       */
      (function() {
        // --- CONSTANTS & CONFIGURATION ---
        const CONFIG = {
          API_URL: "https://script.google.com/macros/s/AKfycbw8Wf9vZsQbksaG7dmtWxw2b26xzCxI0Rl1lTlWggIS_rlULBL-wkOjDgRBZuH_vWI5Lw/exec",
          REQUIRED_AGENCY_IDS: ["agencyName", "subUnit", "contactName", "contactPosition", "contactPhone", "contactEmail"],
          YEAR_START: 2539,
          YEAR_END: 2568,
          // Mapping for fields that have an "Other" toggle option
          TOGGLE_FIELDS: [
            { trigger: '.source-select', wrapper: '.source-other-wrapper', input: '.source-other-input', type: 'select', value: 'other' },
            { trigger: '.resolution-select', wrapper: '.resolution-other-wrapper', input: '.resolution-other-input', type: 'select', checkFn: val => val === 'lidar_sub1m' || val === 'other' },
            { trigger: '.vertical-datum-select', wrapper: '.vertical-datum-other-wrapper', input: '.vertical-datum-other-input', type: 'select', value: 'other' },
            { trigger: '.coord-select', wrapper: '.coord-other-wrapper', input: '.coord-other-input', type: 'select', value: 'other' },
            { trigger: '.license-select', wrapper: '.license-other-wrapper', input: '.license-other-input', type: 'select', value: 'other' },
            { trigger: 'input[name="demMethodOtherFlag[]"]', input: 'input[name="demMethodOther[]"]', type: 'checkbox' },
            { trigger: 'input[name="formatOtherFlag[]"]', input: 'input[name="formatOther[]"]', type: 'checkbox' },
            { trigger: 'input[name="accessOtherFlag[]"]', input: 'input[name="accessOther[]"]', type: 'checkbox' },
            { trigger: 'input[name="qcOtherFlag[]"]', input: 'input[name="qcOther[]"]', type: 'checkbox' },
            { trigger: 'input[name="useOtherFlag[]"]', input: 'input[name="useOther[]"]', type: 'checkbox' }
          ]
        };

        // --- DOM ELEMENTS ---
        const els = {
          container: document.getElementById("demItemsContainer"),
          addBtn: document.getElementById("btnAddDemItem"),
          form: document.getElementById("demSurveyForm"),
          resetBtn: document.getElementById("btnResetForm"),
          contactPhone: document.getElementById("contactPhone"),
          modals: {
            confirm: { el: document.getElementById("confirmModal"), title: document.getElementById("confirmTitle"), msg: document.getElementById("confirmMessage"), ok: document.getElementById("confirmOk"), cancel: document.getElementById("confirmCancel") },
            success: { el: document.getElementById("successModal"), ok: document.getElementById("successOk") }
          }
        };

        let refData = null;
        let confirmCallback = null;

        // --- UTILITIES ---
        const Utils = {
          // Setup numeric/phone input handling
          setupNumeric: (input, type = 'decimal') => {
            if (!input) return;
            input.setAttribute("inputmode", type === 'decimal' ? "decimal" : "numeric");
            const handler = function(e) {
              let val = this.value;
              if (type === 'decimal') {
                val = val.replace(/[^0-9.]/g, "");
                const parts = val.split('.');
                if (parts.length > 2) val = parts[0] + '.' + parts.slice(1).join('');
              } else {
                val = val.replace(/\D/g, "");
              }
              this.value = val;
              if(e.type === 'input') {
                Utils.clearError(this);
                if (type === 'phone' && val.length > 0 && (val.length < 9 || val.length > 10)) this.setCustomValidity("กรุณากรอก 9-10 หลัก");
                else this.setCustomValidity("");
              }
            };
            input.addEventListener("input", handler);
            input.addEventListener("focus", function() { if(type === 'phone') this.value = this.value.replace(/\D/g, ""); });
            input.addEventListener("blur", function() {
              if (type === 'phone') {
                let d = this.value.replace(/\D/g, "");
                if (d.length === 9) this.value = d.replace(/^(\d{2})(\d{3})(\d{4})$/, "$1-$2-$3");
                else if (d.length === 10) this.value = d.replace(/^(\d{3})(\d{3})(\d{4})$/, "$1-$2-$3");
              }
            });
          },
          showError: (input, msgText) => {
            input.classList.add("border-red-500", "focus:border-red-500", "focus:ring-red-500");
            input.classList.remove("border-slate-300", "focus:border-blue-500", "focus:ring-blue-500");
            const p = input.parentElement;
            if (!p.querySelector(".error-text-msg")) {
              const m = document.createElement("p");
              m.className = "error-text-msg text-red-500 text-xs mt-1";
              m.textContent = msgText;
              p.appendChild(m);
            }
          },
          clearError: (input) => {
            input.classList.remove("border-red-500", "focus:border-red-500", "focus:ring-red-500");
            input.classList.add("border-slate-300", "focus:border-blue-500", "focus:ring-blue-500");
            const m = input.parentElement.querySelector(".error-text-msg");
            if (m) m.remove();
          },
          getCheckedValues: (container, selector, excludeOther = false) => {
            let vals = Array.from(container.querySelectorAll(selector + ":checked")).map(el => el.value);
            if (excludeOther) {
              vals = vals.filter(v => {
                if (!v) return false;
                const t = v.toString().toLowerCase().replace(/\s+/g, "");
                return !['other', 'อื่นๆ', 'อื่นๆระบุ', 'อื่นๆ(ระบุ)'].includes(t);
              });
            }
            return vals;
          },
          populateSelect: (selectEl, values) => {
            if (!selectEl) return;
            const selected = Array.from(selectEl.options).filter(o => o.selected).map(o => o.value);
            selectEl.innerHTML = "";
            (values || []).forEach(val => {
              const opt = document.createElement("option");
              opt.value = val; opt.textContent = val;
              if (selected.includes(val)) opt.selected = true;
              selectEl.appendChild(opt);
            });
          }
        };

        // --- MODAL HANDLING ---
        const Modals = {
          openConfirm: (title, message, callback) => {
            els.modals.confirm.title.textContent = title;
            els.modals.confirm.msg.textContent = message;
            confirmCallback = callback;
            els.modals.confirm.el.classList.remove("hidden");
            els.modals.confirm.el.classList.add("flex");
          },
          closeConfirm: () => {
            els.modals.confirm.el.classList.add("hidden");
            els.modals.confirm.el.classList.remove("flex");
            confirmCallback = null;
          },
          openSuccess: () => {
            els.modals.success.el.classList.remove("hidden");
            els.modals.success.el.classList.add("flex");
            els.modals.success.ok.focus();
          },
          closeSuccess: () => {
            els.modals.success.el.classList.add("hidden");
            els.modals.success.el.classList.remove("flex");
          }
        };

        // Event Listeners for Modals
        els.modals.confirm.cancel.addEventListener("click", Modals.closeConfirm);
        els.modals.confirm.ok.addEventListener("click", () => { if (confirmCallback) confirmCallback(); Modals.closeConfirm(); });
        els.modals.confirm.el.addEventListener("click", e => { if (e.target === els.modals.confirm.el) Modals.closeConfirm(); });
        els.modals.success.ok.addEventListener("click", Modals.closeSuccess);
        els.modals.success.el.addEventListener("click", e => { if (e.target === els.modals.success.el) Modals.closeSuccess(); });
        document.addEventListener("keydown", e => { if (e.key === "Escape") { Modals.closeConfirm(); Modals.closeSuccess(); } });

        // --- CORE LOGIC ---
        
        async function init() {
          // Setup Contact Phone
          Utils.setupNumeric(els.contactPhone, 'phone');
          
          // Setup Required Agency Fields
          CONFIG.REQUIRED_AGENCY_IDS.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.required = true;
          });

          // Init first item
          const firstItem = els.container.querySelector(".dem-item");
          FormHandler.attachEvents(firstItem);
          FormHandler.populateYears();
          FormHandler.updateIndexes();
          
          // Load Reference Data
          try {
            const resp = await fetch(CONFIG.API_URL + "?action=getReferenceData");
            refData = await resp.json() || { basins: [], provinces: [] };
            FormHandler.applyRefData();
          } catch (err) { console.error("RefData Error", err); }
        }

        const FormHandler = {
          attachEvents: (item) => {
            if (!item) return;
            
            // 1. Toggles (Section visibility)
            FormHandler.setupSectionToggles(item);
            
            // 2. Required Fields in Item
            const reqs = ['input[name="demName[]"]', 'select[name="sourceType[]"]', 'select[name="year[]"]'];
            reqs.forEach(sel => { const el = item.querySelector(sel); if(el) el.required = true; });

            // 3. Numeric Fields
            ['verticalAccuracy[]', 'horizontalAccuracy[]', 'fileSize[]'].forEach(name => {
              Utils.setupNumeric(item.querySelector(`input[name="${name}"]`), 'decimal');
            });

            // 4. "Other" Fields Logic (Optimized Loop)
            CONFIG.TOGGLE_FIELDS.forEach(conf => {
              const trigger = item.querySelector(conf.trigger);
              const input = item.querySelector(conf.input);
              const wrapper = conf.wrapper ? item.querySelector(conf.wrapper) : null;
              
              if (!trigger || !input) return;

              const handler = () => {
                let show = false;
                if (conf.type === 'select') {
                  const val = trigger.value;
                  show = conf.checkFn ? conf.checkFn(val) : (val === conf.value);
                } else { // checkbox
                  show = trigger.checked;
                }
                
                if (wrapper) wrapper.classList.toggle("hidden", !show);
                input.disabled = !show;
                if (!show) {
                   input.value = "";
                   Utils.clearError(input);
                } else {
                   // Optional: input.focus();
                }
              };
              trigger.addEventListener("change", handler);
              handler(); // Init state
            });

            // 5. Coverage Logic (Complex interaction)
            FormHandler.setupCoverageLogic(item);

            // 6. Search Filters for Basin/Province
            ['basin', 'province'].forEach(type => {
               const search = item.querySelector(`.${type}-search`);
               const select = item.querySelector(`.${type}-select`);
               if(search && select) {
                 search.addEventListener("input", () => {
                   const term = search.value.trim().toLowerCase();
                   Array.from(select.options).forEach((opt, i) => {
                     if (i===0 && opt.value === "") { opt.hidden = false; return; } // placeholder
                     opt.hidden = term ? !opt.textContent.toLowerCase().includes(term) : false;
                   });
                 });
               }
            });

            // 7. Remove Button
            const rmBtn = item.querySelector(".btn-remove-dem-item");
            if (rmBtn) rmBtn.addEventListener("click", () => { item.remove(); FormHandler.updateIndexes(); });
          },

          setupSectionToggles: (item) => {
            const cards = item.querySelectorAll(".section-card");
            const toggleBtn = (card, show) => {
               const body = card.querySelector(".section-body");
               const btn = card.querySelector(".section-toggle");
               if(!body || !btn) return;
               body.classList.toggle("hidden", !show);
               btn.dataset.state = show ? "shown" : "hidden";
               btn.querySelector(".toggle-label").textContent = show ? "ซ่อน" : "แสดง";
            };
            
            // Init: Show A, Hide others
            cards.forEach((c, i) => toggleBtn(c, i === 0));
            cards.forEach(c => c.querySelector(".section-toggle")?.addEventListener("click", () => {
               toggleBtn(c, c.querySelector(".section-body").classList.contains("hidden"));
               updateMasterToggle();
            }));

            const master = item.querySelector(".item-toggle-all");
            const updateMasterToggle = () => {
               if(!master) return;
               const hidden = Array.from(cards).some(c => c.querySelector(".section-body").classList.contains("hidden"));
               master.dataset.state = hidden ? "hidden" : "shown";
               master.querySelector(".toggle-label").textContent = hidden ? "แสดง" : "ซ่อน";
            };
            if(master) master.addEventListener("click", () => {
               const show = master.dataset.state === "hidden";
               cards.forEach(c => toggleBtn(c, show));
               updateMasterToggle();
            });
          },

          setupCoverageLogic: (item) => {
             const els = {
               country: item.querySelector('input[name="coverageCountry[]"]'),
               basinToggle: item.querySelector(".toggle-basin"),
               provToggle: item.querySelector(".toggle-province"),
               localToggle: item.querySelector(".toggle-local"),
               basinBlock: item.querySelector(".basin-block"),
               provBlock: item.querySelector(".province-block"),
               localBlock: item.querySelector(".local-block"),
               localInput: item.querySelector(".local-input"),
               basinTags: item.querySelector(".basin-tags"),
               provTags: item.querySelector(".province-tags"),
               basinHidden: item.querySelector(".basin-other-input"),
               provHidden: item.querySelector(".province-other-input"),
               basinSelect: item.querySelector(".basin-select"),
               provSelect: item.querySelector(".province-select")
             };

             // Tag Stack Logic
             const setupTags = (select, container, hidden) => {
                if(!select) return;
                const update = (vals) => {
                   container.innerHTML = vals.map(v => `<span class="tag-pill" data-val="${v}"><span class="tag-text">${v}</span><span class="tag-remove">×</span></span>`).join('');
                   hidden.value = vals.join(", ");
                };
                select.addEventListener("dblclick", () => {
                   const val = select.value;
                   if(!val) return;
                   let curr = hidden.value ? hidden.value.split(", ") : [];
                   if(curr.includes(val)) curr = curr.filter(x => x !== val);
                   else curr.push(val);
                   update(curr);
                });
                container.addEventListener("click", e => {
                   const btn = e.target.closest(".tag-remove");
                   if(!btn) return;
                   const val = btn.closest(".tag-pill").dataset.val;
                   update(hidden.value.split(", ").filter(x => x !== val));
                });
             };
             setupTags(els.basinSelect, els.basinTags, els.basinHidden);
             setupTags(els.provSelect, els.provTags, els.provHidden);

             const updateState = () => {
                const isCountry = els.country && els.country.checked;
                if (isCountry) {
                   [els.basinToggle, els.provToggle, els.localToggle].forEach(el => { if(el) { el.checked = false; el.disabled = true; }});
                   [els.basinBlock, els.provBlock, els.localBlock].forEach(el => el && el.classList.add("hidden"));
                   if(els.basinTags) els.basinTags.innerHTML = "";
                   if(els.provTags) els.provTags.innerHTML = "";
                   if(els.basinHidden) els.basinHidden.value = "";
                   if(els.provHidden) els.provHidden.value = "";
                   if(els.localInput) { els.localInput.value = ""; els.localInput.disabled = true; Utils.clearError(els.localInput); }
                } else {
                   [els.basinToggle, els.provToggle, els.localToggle].forEach(el => { if(el) el.disabled = false; });
                   if(els.basinBlock) els.basinBlock.classList.toggle("hidden", !els.basinToggle.checked);
                   if(els.provBlock) els.provBlock.classList.toggle("hidden", !els.provToggle.checked);
                   const showLocal = els.localToggle.checked;
                   if(els.localBlock) els.localBlock.classList.toggle("hidden", !showLocal);
                   if(els.localInput) { 
                      els.localInput.disabled = !showLocal; 
                      if(!showLocal) { els.localInput.value = ""; Utils.clearError(els.localInput); }
                   }
                }
             };

             [els.country, els.basinToggle, els.provToggle, els.localToggle].forEach(el => el && el.addEventListener("change", updateState));
             updateState(); // Init
          },

          populateYears: () => {
            const selects = document.querySelectorAll(".year-select");
            selects.forEach(sel => {
              if (sel.options.length > 1) return;
              for (let y = CONFIG.YEAR_END; y >= CONFIG.YEAR_START; y--) {
                const opt = document.createElement("option");
                opt.value = y; opt.textContent = y.toString();
                sel.appendChild(opt);
              }
              sel.classList.add("text-sm");
            });
          },

          updateIndexes: () => {
            const items = els.container.querySelectorAll(".dem-item");
            items.forEach((item, idx) => {
               const i = idx + 1;
               const badge = item.querySelector(".dem-index");
               if(badge) badge.style.display = 'none';
               
               const h3 = item.querySelector("h3");
               if(h3) {
                 // Clean old text nodes
                 Array.from(h3.childNodes).filter(n => n.nodeType === Node.TEXT_NODE).forEach(n => n.remove());
                 // Insert new text
                 let title = h3.querySelector(".dem-title-text");
                 if(!title) { 
                    title = document.createElement("span"); title.className = "dem-title-text ml-1"; 
                    h3.prepend(title);
                 }
                 title.textContent = `ชุดข้อมูลที่ ${i}`;
               }

               const rmBtn = item.querySelector(".btn-remove-dem-item");
               if(rmBtn) {
                 rmBtn.classList.toggle("hidden", items.length === 1);
                 rmBtn.classList.add("bg-rose-600", "text-white", "border-rose-600", "hover:bg-rose-700");
                 rmBtn.classList.remove("bg-white");
               }
            });
          },

          applyRefData: () => {
            if(!refData) return;
            document.querySelectorAll(".basin-select").forEach(s => Utils.populateSelect(s, refData.basins));
            document.querySelectorAll(".province-select").forEach(s => Utils.populateSelect(s, refData.provinces));
          },

          resetForm: () => {
             els.form.reset();
             // Keep only first item
             const items = els.container.querySelectorAll(".dem-item");
             items.forEach((item, i) => { if(i > 0) item.remove(); });
             
             // Reset UI state of first item
             const first = els.container.querySelector(".dem-item");
             if(first) {
                first.querySelectorAll(".basin-tags, .province-tags").forEach(e => e.innerHTML = "");
                first.querySelectorAll(".basin-other-input, .province-other-input").forEach(e => e.value = "");
                first.querySelectorAll(".basin-block, .province-block, .local-block").forEach(e => e.classList.add("hidden"));
                const localIn = first.querySelector(".local-input");
                if(localIn) { localIn.disabled = true; Utils.clearError(localIn); }
                
                // Re-attach to ensure state consistency
                FormHandler.attachEvents(first);
             }
             
             FormHandler.updateIndexes();
             FormHandler.populateYears();
             FormHandler.applyRefData();
             els.form.querySelectorAll(".error-text-msg").forEach(e => e.remove());
             els.form.querySelectorAll(".border-red-500").forEach(e => Utils.clearError(e));
          }
        };

        // --- FORM ACTION HANDLERS ---

        els.addBtn.addEventListener("click", () => {
           const clone = els.container.querySelector(".dem-item").cloneNode(true);
           // Reset values
           clone.querySelectorAll("input, textarea, select").forEach(el => {
              if (el.tagName === "SELECT") el.selectedIndex = 0;
              else if (el.type === "checkbox" || el.type === "radio") { el.checked = false; el.disabled = false; }
              else el.value = "";
              Utils.clearError(el);
           });
           // Reset specific dynamic UI parts
           clone.querySelectorAll(".basin-tags, .province-tags").forEach(e => e.innerHTML = "");
           clone.querySelectorAll(".hidden").forEach(e => {
              // Don't unhide wrappers, keep them hidden. Logic handles toggles.
           });
           // Re-hide toggle wrappers that might be open in clone
           CONFIG.TOGGLE_FIELDS.forEach(c => {
              if(c.wrapper) clone.querySelector(c.wrapper)?.classList.add("hidden");
              const inp = clone.querySelector(c.input);
              if(inp) inp.disabled = true;
           });
           // Re-hide blocks
           clone.querySelectorAll(".basin-block, .province-block, .local-block").forEach(e => e.classList.add("hidden"));
           
           els.container.appendChild(clone);
           FormHandler.attachEvents(clone);
           FormHandler.populateYears();
           FormHandler.updateIndexes();
           FormHandler.applyRefData();
        });

        els.resetBtn.addEventListener("click", (e) => {
           e.preventDefault();
           Modals.openConfirm("ยืนยันล้างข้อมูล", "คุณต้องการล้างค่าทั้งหมดในแบบฟอร์มหรือไม่?", FormHandler.resetForm);
        });

        const validateForm = () => {
           let isValid = true;
           let firstErr = null;
           const inputs = els.form.querySelectorAll("[required]:not([disabled])");
           inputs.forEach(input => {
              if(!input.value.trim()) {
                 Utils.showError(input, "* จำเป็น (โปรดระบุ)");
                 isValid = false;
                 if(!firstErr) firstErr = input;
                 input.addEventListener("input", function() { Utils.clearError(this); }, {once:true});
                 input.addEventListener("change", function() { Utils.clearError(this); }, {once:true});
              } else {
                 Utils.clearError(input);
              }
           });
           if(firstErr) {
              firstErr.scrollIntoView({ behavior: "smooth", block: "center" });
              firstErr.focus();
           }
           return isValid;
        };

        const collectData = () => {
           // Helper
           const getVal = (itm, sel) => itm.querySelector(sel)?.value.trim() || "";
           const getCheck = (itm, sel, excl=false) => Utils.getCheckedValues(itm, sel, excl);
           const getOther = (itm, chkName, inpName) => {
              const has = itm.querySelector(`input[name="${chkName}"]`)?.checked;
              return has ? (itm.querySelector(`input[name="${inpName}"]`)?.value.trim() || "") : "";
           };

           const agency = {
              agencyName: document.getElementById("agencyName").value.trim(),
              subUnit: document.getElementById("subUnit").value.trim(),
              contactName: document.getElementById("contactName").value.trim(),
              contactPosition: document.getElementById("contactPosition").value.trim(),
              contactPhone: document.getElementById("contactPhone").value.trim(),
              contactEmail: document.getElementById("contactEmail").value.trim(),
           };

           const items = [];
           els.container.querySelectorAll(".dem-item").forEach(item => {
              const d = {};
              d.demName = getVal(item, 'input[name="demName[]"]');
              
              // Source
              const srcSel = item.querySelector('select[name="sourceType[]"]');
              d.sourceType = (srcSel?.value === 'other') ? getVal(item, 'input[name="sourceOther[]"]') : (srcSel?.value || "");
              
              d.year = getVal(item, 'select[name="year[]"]');

              // Coverage
              const rawCountry = getCheck(item, 'input[name="coverageCountry[]"]');
              d.coverageCountry = rawCountry.map(v => v === 'thailand_all' ? 'ทั่วประเทศ' : v);
              d.coverageBasinTags = getVal(item, '.basin-other-input');
              d.coverageProvinceTags = getVal(item, '.province-other-input');
              d.coverageLocal = getVal(item, 'input[name="coverageLocal[]"]');

              // Tech
              const resSel = item.querySelector('select[name="resolution[]"]');
              d.resolution = (resSel?.value === 'other' || resSel?.value === 'lidar_sub1m') ? getVal(item, 'input[name="resolutionOther[]"]') : (resSel?.value || "");
              
              d.verticalAccuracy = getVal(item, 'input[name="verticalAccuracy[]"]');
              d.horizontalAccuracy = getVal(item, 'input[name="horizontalAccuracy[]"]');
              
              const vDatSel = item.querySelector('select[name="verticalDatum[]"]');
              d.verticalDatum = (vDatSel?.value === 'other') ? getVal(item, 'input[name="verticalDatumOther[]"]') : (vDatSel?.value || "");

              const coSel = item.querySelector('select[name="coordSys[]"]');
              d.coordSys = (coSel?.value === 'other') ? getVal(item, 'input[name="coordSysOther[]"]') : (coSel?.value || "");

              // Multi-checkbox with Other
              d.demMethods = getCheck(item, 'input[name^="demMethod"]', true);
              const dmOther = getOther(item, 'demMethodOtherFlag[]', 'demMethodOther[]');
              if(dmOther) d.demMethods.push(dmOther);

              d.fileFormats = getCheck(item, 'input[name^="format"]', true);
              const fmtOther = getOther(item, 'formatOtherFlag[]', 'formatOther[]');
              if(fmtOther) d.fileFormats.push(fmtOther);

              d.fileSize = getVal(item, 'input[name="fileSize[]"]');
              d.fileSizeUnit = getVal(item, 'select[name="fileSizeUnit[]"]');

              const licSel = item.querySelector('select[name="license[]"]');
              d.license = (licSel?.value === 'other') ? getVal(item, 'input[name="licenseOther[]"]') : (licSel?.value || "");

              d.accessChannels = getCheck(item, 'input[name^="access"]', true);
              const accOther = getOther(item, 'accessOtherFlag[]', 'accessOther[]');
              if(accOther) d.accessChannels.push(accOther); // Assuming backend expects array or appended string logic from previous, keeping consistant with "Other" field

              d.accessOther = getVal(item, 'input[name="accessOther[]"]'); // Legacy field mapping if needed separately

              d.qcQa = getCheck(item, 'input[name^="qc"]', true);
              d.qcQaOther = getVal(item, 'input[name="qcOther[]"]');

              d.mainUses = getCheck(item, 'input[name^="use"]', true);
              d.mainUsesOther = getVal(item, 'input[name="useOther[]"]');

              d.remark = getVal(item, 'textarea[name="remark[]"]');
              items.push(d);
           });

           return { agency, items };
        };

        els.form.addEventListener("submit", (e) => {
           e.preventDefault();
           if(!validateForm()) return;

           Modals.openConfirm("ยืนยันการส่งแบบฟอร์ม", "โปรดตรวจสอบข้อมูลให้ถูกต้อง ก่อนยืนยันการส่งแบบฟอร์ม", async () => {
              const payload = collectData();
              try {
                 const res = await fetch(CONFIG.API_URL, {
                    method: "POST",
                    headers: { "Content-Type": "text/plain;charset=utf-8" },
                    body: JSON.stringify(payload),
                 });
                 const data = await res.json();
                 if(data && (data.success || data.result === "success")) { // flexible check
                    Modals.openSuccess();
                    FormHandler.resetForm(); // Auto reset on success
                 } else {
                    alert("บันทึกข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
                 }
              } catch(err) {
                 console.error("Submit Error", err);
                 alert("เกิดข้อผิดพลาดในการเชื่อมต่อ");
              }
           });
        });

        // Initialize App
        init();

      })();
