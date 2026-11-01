// Branching dialogue state machine with typewriter reveal, conditional choices,
// action callbacks, and non-blocking tactical radio/boss barks for action games.
//
//   const dialogue = new DialogueSystem({ charsPerSecond: 45 });
//   dialogue.addNode('shrine_1', {
//     speaker: 'ANCIENT SHRINE',
//     text: 'Offer 25 HP for +35% Damage?',
//     choices: [
//       { label: 'Accept Offering', next: 'accepted', condition: (p) => p.hp > 25, action: (p) => p.buff() },
//       { label: 'Leave', next: null }
//     ]
//   });
//   dialogue.start('shrine_1', playerContext);
//   dialogue.bark('HQ COMMS', 'Peak swarm surge incoming!', { duration: 3200 });

export class DialogueSystem {
  constructor({ charsPerSecond = 45, onNodeEnter = null, onEnd = null } = {}) {
    this.charsPerSecond = Math.max(1, charsPerSecond);
    this.onNodeEnter = onNodeEnter;
    this.onEnd = onEnd;

    this.nodes = new Map();
    this.currentId = null;
    this.currentNode = null;
    this.context = null;
    this.charIndex = 0;

    this.barkQueue = [];
    this.activeBark = null;
  }

  get isActive() {
    return this.currentNode !== null;
  }

  get isTyping() {
    return Boolean(this.currentNode && this.charIndex < this.currentNode.text.length);
  }

  get visibleText() {
    if (!this.currentNode) return '';
    return this.currentNode.text.slice(0, Math.floor(this.charIndex));
  }

  addNode(id, {
    speaker = '',
    portrait = null,
    text = '',
    next = null,
    choices = null,
    onEnter = null
  } = {}) {
    if (!id) throw new Error('DialogueSystem.addNode: id is required');
    this.nodes.set(id, {
      id,
      speaker,
      portrait,
      text: String(text),
      next,
      choices: Array.isArray(choices) ? choices : null,
      onEnter
    });
    return this;
  }

  start(nodeId, context = null) {
    if (!this.nodes.has(nodeId)) {
      throw new Error(`DialogueSystem.start: unknown node "${nodeId}"`);
    }
    this.context = context;
    this._enterNode(nodeId);
    return this.getState();
  }

  // Skips typewriter animation if still typing; otherwise advances linear nodes.
  advance() {
    if (!this.currentNode) return false;

    if (this.isTyping) {
      this.charIndex = this.currentNode.text.length;
      return true;
    }

    const choices = this.getAvailableChoices();
    if (choices.length > 0) {
      return false;
    }

    if (this.currentNode.next) {
      this._enterNode(this.currentNode.next);
      return true;
    }

    this.close();
    return false;
  }

  choose(choiceIndex = 0) {
    if (!this.currentNode) return false;
    if (this.isTyping) {
      this.charIndex = this.currentNode.text.length;
    }

    const choices = this.getAvailableChoices();
    if (choiceIndex < 0 || choiceIndex >= choices.length) return false;

    const picked = choices[choiceIndex];
    if (picked.action) {
      picked.action(this.context);
    }

    if (picked.next) {
      this._enterNode(picked.next);
    } else {
      this.close();
    }
    return true;
  }

  getAvailableChoices() {
    if (!this.currentNode || !this.currentNode.choices) return [];
    const out = [];
    for (let i = 0; i < this.currentNode.choices.length; i++) {
      const c = this.currentNode.choices[i];
      if (!c.condition || c.condition(this.context)) {
        out.push(c);
      }
    }
    return out;
  }

  close() {
    const wasActive = this.currentNode !== null;
    this.currentId = null;
    this.currentNode = null;
    this.charIndex = 0;
    if (wasActive && this.onEnd) {
      this.onEnd(this.context);
    }
  }

  // Queues a non-blocking tactical radio/boss transmission banner for real-time combat.
  bark(speaker, text, { duration = 3000, color = '#d9b978' } = {}) {
    const item = {
      speaker,
      text: String(text),
      duration: Math.max(400, duration),
      remaining: Math.max(400, duration),
      charIndex: 0,
      color
    };

    if (!this.activeBark) {
      this.activeBark = item;
    } else {
      this.barkQueue.push(item);
    }
    return item;
  }

  clearBarks() {
    this.activeBark = null;
    this.barkQueue.length = 0;
  }

  update(dt) {
    const dtSec = dt / 1000;

    if (this.currentNode && this.charIndex < this.currentNode.text.length) {
      this.charIndex = Math.min(
        this.currentNode.text.length,
        this.charIndex + this.charsPerSecond * dtSec
      );
    }

    if (this.activeBark) {
      this.activeBark.charIndex = Math.min(
        this.activeBark.text.length,
        this.activeBark.charIndex + this.charsPerSecond * 1.3 * dtSec
      );
      this.activeBark.remaining -= dt;
      if (this.activeBark.remaining <= 0) {
        this.activeBark = this.barkQueue.length > 0 ? this.barkQueue.shift() : null;
      }
    }
  }

  getState() {
    if (!this.currentNode) return null;
    return {
      id: this.currentId,
      speaker: this.currentNode.speaker,
      portrait: this.currentNode.portrait,
      fullText: this.currentNode.text,
      visibleText: this.visibleText,
      isTyping: this.isTyping,
      choices: this.getAvailableChoices()
    };
  }

  // Draws the active non-blocking radio/boss bark banner onto a 2D canvas.
  renderBarkBanner(ctx, canvasWidth = 800, y = 46) {
    if (!this.activeBark) return;

    const b = this.activeBark;
    const w = Math.min(460, canvasWidth - 40);
    const x = (canvasWidth - w) * 0.5;
    const h = 42;
    const alpha = Math.min(1, b.remaining / 300);

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = alpha;

    ctx.fillStyle = 'rgba(16, 22, 36, 0.92)';
    ctx.strokeStyle = b.color;
    ctx.lineWidth = 1.5;
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);

    ctx.fillStyle = b.color;
    ctx.fillRect(x, y, 4, h);

    ctx.font = 'bold 10px monospace';
    ctx.fillText(`[COMMS // ${b.speaker}]`, x + 12, y + 15);

    ctx.fillStyle = '#f3ead3';
    ctx.font = '11px monospace';
    const vis = b.text.slice(0, Math.floor(b.charIndex));
    ctx.fillText(vis, x + 12, y + 32);

    ctx.restore();
  }

  _enterNode(nodeId) {
    const node = this.nodes.get(nodeId);
    if (!node) {
      this.close();
      return;
    }
    this.currentId = nodeId;
    this.currentNode = node;
    this.charIndex = 0;

    if (node.onEnter) node.onEnter(this.context);
    if (this.onNodeEnter) this.onNodeEnter(this.getState(), this.context);
  }
}