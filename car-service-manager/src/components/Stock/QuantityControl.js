import React from 'react';
import { FaMinus, FaPlus } from 'react-icons/fa';

function QuantityControl({ quantity, onIncrement, onDecrement, disabled = false }) {
  return (
    <div className="stock-qty-control">
      <button
        type="button"
        className="stock-qty-btn"
        onClick={onDecrement}
        disabled={disabled || quantity <= 0}
        aria-label="Remove one"
        title="Remove one"
      >
        <FaMinus />
      </button>
      <span className="stock-qty-value">{quantity}</span>
      <button
        type="button"
        className="stock-qty-btn"
        onClick={onIncrement}
        disabled={disabled}
        aria-label="Add one"
        title="Add one"
      >
        <FaPlus />
      </button>
    </div>
  );
}

export default QuantityControl;
