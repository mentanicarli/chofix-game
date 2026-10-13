/**
 * Каркас станций бара. Станция — чистая логика одного шага рецепта:
 * получает ввод игрока и время, хранит своё состояние, в конце отдаёт оценку 0..1.
 * Никакого DOM и рисования: рендер читает `state` и рисует его как хочет.
 */
export type Message = { text: string; bad: boolean };

export interface StationResult {
  /** Оценка шага 0..1. */
  score: number;
  message?: Message;
}

/** Побочные эффекты, которые станция просит у игры (деньги, звуки). Исполняет оболочка, не станция. */
export type Effect = { kind: 'cost'; amount: number } | { kind: 'sound'; id: string };

export interface StationStep {
  /** Станция закончена — оценка в `result`. */
  result?: StationResult;
  /** Сообщение без завершения (ошибка ввода, подсказка). */
  message?: Message;
  effects?: Effect[];
}

export interface Station<S, I> {
  readonly id: string;
  init(order: I): S;
  /** Игровое время. dt — секунды. holding — зажата ли кнопка/мышь на станции. */
  update(state: S, dt: number, holding: boolean): StationStep | undefined;
  /** Игрок нажал «Готово». */
  finish(state: S): StationStep;
}
