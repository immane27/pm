from pydantic import BaseModel, Field


class Card(BaseModel):
    id: str
    title: str = Field(min_length=1)
    details: str


class Column(BaseModel):
    id: str
    title: str
    cardIds: list[str]


class Board(BaseModel):
    columns: list[Column]
    cards: dict[str, Card]


DEFAULT_BOARD = Board.model_validate(
    {
        "columns": [
            {"id": "col-backlog", "title": "Backlog", "cardIds": ["card-1", "card-2"]},
            {"id": "col-discovery", "title": "Discovery", "cardIds": ["card-3"]},
            {"id": "col-progress", "title": "In Progress", "cardIds": ["card-4", "card-5"]},
            {"id": "col-review", "title": "Review", "cardIds": ["card-6"]},
            {"id": "col-done", "title": "Done", "cardIds": ["card-7", "card-8"]},
        ],
        "cards": {
            "card-1": {"id": "card-1", "title": "Align roadmap themes", "details": "Draft quarterly themes with impact statements and metrics."},
            "card-2": {"id": "card-2", "title": "Gather customer signals", "details": "Review support tags, sales notes, and churn feedback."},
            "card-3": {"id": "card-3", "title": "Prototype analytics view", "details": "Sketch initial dashboard layout and key drill-downs."},
            "card-4": {"id": "card-4", "title": "Refine status language", "details": "Standardize column labels and tone across the board."},
            "card-5": {"id": "card-5", "title": "Design card layout", "details": "Add hierarchy and spacing for scanning dense lists."},
            "card-6": {"id": "card-6", "title": "QA micro-interactions", "details": "Verify hover, focus, and loading states."},
            "card-7": {"id": "card-7", "title": "Ship marketing page", "details": "Final copy approved and asset pack delivered."},
            "card-8": {"id": "card-8", "title": "Close onboarding sprint", "details": "Document release notes and share internally."},
        },
    }
)


def validate_board(board: Board, current: Board) -> None:
    """Raise ValueError if board breaks the rules in docs/DATABASE.md."""
    if [c.id for c in board.columns] != [c.id for c in current.columns]:
        raise ValueError("Columns are fixed: ids and order must not change")

    placed = [card_id for column in board.columns for card_id in column.cardIds]
    if len(placed) != len(set(placed)):
        raise ValueError("A card appears more than once")
    if set(placed) != set(board.cards):
        raise ValueError("Every card must be in exactly one column")
    for key, card in board.cards.items():
        if card.id != key:
            raise ValueError(f"Card key {key} does not match id {card.id}")
