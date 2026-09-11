import test from 'node:test';
import assert from 'node:assert/strict';
import { architecture, compile, document, entity, role, swimlane } from '../src/index.ts';
import type { NodeLayout, Point, Relation, Scene } from '../src/model.ts';

const worker = role({ id: 'worker', label: '处理者' });
const nodes = [
  { id: 'center', x: 400, y: 320 },
  { id: 'right', x: 750, y: 320 },
  { id: 'bottom', x: 400, y: 600 },
  { id: 'left', x: 50, y: 320 },
  { id: 'top', x: 400, y: 40 },
  { id: 'upper-right', x: 750, y: 40 },
  { id: 'lower-right', x: 750, y: 600 }
].map(({ id, x, y }) => ({
  entity: entity({ id, label: id }), role: worker,
  position: { x, y }, size: { width: 160, height: 80 }
}));

function sceneFor(kind: 'architecture' | 'swimlane', relations: Relation[]) {
  const options = { id: 'ports', title: '连接点', nodes, relations };
  const chart = kind === 'architecture' ? architecture(options) : swimlane({
    ...options, width: 1180,
    lanes: [{ id: 'work', label: '处理', height: 800 }],
    nodes: nodes.map(node => ({ ...node, lane: 'work' }))
  });
  return compile(document().diagram(chart)).scenes[0];
}

function assertPort(node: NodeLayout, point: Point, neighbor: Point) {
  const cx = node.x + node.width / 2, cy = node.y + node.height / 2;
  const [x, y] = point, [nx, ny] = neighbor;
  assert.ok(
    (x === cx && y === node.y && nx === x && ny < y)
    || (x === cx && y === node.y + node.height && nx === x && ny > y)
    || (x === node.x && y === cy && ny === y && nx < x)
    || (x === node.x + node.width && y === cy && ny === y && nx > x),
    `${node.id}: ${point} must meet a side midpoint perpendicularly from outside`
  );
}

function assertRoutes(scene: Scene) {
  const boxes = new Map(scene.nodes.map(node => [node.id, node]));
  for (const edge of scene.edges) {
    assertPort(boxes.get(edge.from)!, edge.points[0], edge.points[1]);
    assertPort(boxes.get(edge.to)!, edge.points.at(-1)!, edge.points.at(-2)!);
    for (let i = 1; i < edge.points.length; i++) {
      const [ax, ay] = edge.points[i - 1], [bx, by] = edge.points[i];
      assert.ok(ax === bx || ay === by);
      for (const node of scene.nodes) {
        const crosses = ax === bx
          ? ax > node.x && ax < node.x + node.width && Math.max(ay, by) > node.y && Math.min(ay, by) < node.y + node.height
          : ay > node.y && ay < node.y + node.height && Math.max(ax, bx) > node.x && Math.min(ax, bx) < node.x + node.width;
        assert.ok(!crosses, `${edge.id} crosses ${node.id}`);
      }
    }
  }
}

for (const kind of ['architecture', 'swimlane'] as const) {
  test(`${kind} shares four midpoint ports for many incoming or outgoing relations in either order`, () => {
    for (const incoming of [false, true]) {
      const relations = nodes.slice(1).map(({ entity }) => ({
        id: `link-${entity.id}`, from: incoming ? entity.id : 'center',
        to: incoming ? 'center' : entity.id, label: entity.label
      }));
      for (const ordered of [relations, [...relations].reverse()]) {
        const scene = sceneFor(kind, ordered);
        assertRoutes(scene);
        const ports = new Set(scene.edges.map(edge => JSON.stringify(incoming ? edge.points.at(-1) : edge.points[0])));
        assert.ok(ports.size <= 4);
        assert.equal(scene.edges.length, 6);
      }
    }
  });

  test(`${kind} keeps self loops, parallel and reverse relations distinct using midpoint ports`, () => {
    const relations = [
      { id: 'first', from: 'left', to: 'right', label: '首次' },
      { id: 'second', from: 'left', to: 'right', label: '再次' },
      { id: 'back', from: 'right', to: 'left', label: '返回' },
      { id: 'self', from: 'center', to: 'center', label: '重试' }
    ];
    const scene = sceneFor(kind, relations);
    assertRoutes(scene);
    const paths = scene.edges.map(edge => {
      const forward = JSON.stringify(edge.points), backward = JSON.stringify([...edge.points].reverse());
      return forward < backward ? forward : backward;
    });
    assert.equal(new Set(paths).size, relations.length);
    const loop = scene.edges.at(-1)!;
    assert.notDeepEqual(loop.points[0], loop.points.at(-1));
    assert.deepEqual(sceneFor(kind, relations), scene);
  });
}
