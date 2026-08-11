from pydantic import BaseModel, ConfigDict
from decimal import Decimal

class ShippingProviderResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    public_id: str
    code: str
    name: str
    fixed_fee: Decimal
    logo_url: str | None = None
    active: bool
